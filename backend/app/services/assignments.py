from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    XAssignmentAnswer,
    XAssignmentQuestion,
    XAssignmentTemplate,
    XAssignmentValidation,
    XEmployeeAssignment,
)
from app.schemas.assignments import AssignmentAnswerIn
from app.services.rule_engine import RuleEngineService
from app.services.supervisor_validation import SupervisorValidationService

COMPLETED_STATES = {"completed", "validated", "cancelled"}


class AssignmentService:
    def __init__(self, db: Session, company_id: int, user_id: int | None = None):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id

    def generate_assignments_for_shift(self, employee_id: int, shift_id: int, context: dict | None = None) -> list[XEmployeeAssignment]:
        context = context or {}
        rules = RuleEngineService(self.db, self.company_id).assignment_rules(employee_id, {**context, "shift_id": shift_id})
        generated = []
        for rule in rules:
            exists = (
                self.db.query(XEmployeeAssignment)
                .filter_by(company_id=self.company_id, employee_id=employee_id, shift_id=shift_id, template_id=rule.assignment_template_id)
                .first()
            )
            template = self.db.get(XAssignmentTemplate, rule.assignment_template_id) if rule.assignment_template_id else None
            if exists or not template or template.company_id != self.company_id or not template.active or template.state != "active":
                continue
            assignment = XEmployeeAssignment(
                company_id=self.company_id,
                employee_id=employee_id,
                shift_id=shift_id,
                template_id=template.id,
                required=rule.required,
                blocks_check_in=rule.blocks_check_in,
                blocks_check_out=rule.blocks_check_out,
                state="pending",
                applied_rule_id=rule.id,
                create_uid=self.user_id,
                write_uid=self.user_id,
            )
            self.db.add(assignment)
            self.db.flush()
            generated.append(assignment)
        return generated

    def get_pending_assignments(self, employee_id: int, shift_id: int | None = None) -> list[XEmployeeAssignment]:
        query = self.db.query(XEmployeeAssignment).filter(
            XEmployeeAssignment.company_id == self.company_id,
            XEmployeeAssignment.employee_id == employee_id,
            XEmployeeAssignment.state.notin_(list(COMPLETED_STATES)),
        )
        if shift_id is not None:
            query = query.filter(XEmployeeAssignment.shift_id == shift_id)
        return query.order_by(XEmployeeAssignment.assigned_at.desc()).all()

    def save_assignment_answers(self, employee_assignment_id: int, answers: list[AssignmentAnswerIn]) -> list[XAssignmentAnswer]:
        assignment = self._get_assignment(employee_assignment_id)
        assignment.state = "in_progress"
        saved = []
        for item in answers:
            question = self.db.get(XAssignmentQuestion, item.question_id)
            if not question or question.company_id != self.company_id or question.template_id != assignment.template_id or not question.active:
                raise HTTPException(status_code=404, detail="Pregunta no encontrada")
            if question.required and not any([item.answer_text, item.answer_number is not None, item.answer_boolean is not None, item.answer_json]):
                raise HTTPException(status_code=422, detail=f"Pregunta requerida: {question.name}")
            if question.requires_evidence and not item.evidence_url:
                raise HTTPException(status_code=422, detail=f"Evidencia requerida: {question.name}")
            answer = self.db.query(XAssignmentAnswer).filter_by(company_id=self.company_id, employee_assignment_id=assignment.id, question_id=question.id).first()
            if not answer:
                answer = XAssignmentAnswer(company_id=self.company_id, employee_assignment_id=assignment.id, question_id=question.id, create_uid=self.user_id, write_uid=self.user_id)
                self.db.add(answer)
            for field, value in item.model_dump().items():
                if field != "question_id":
                    setattr(answer, field, value)
            answer.answered_by = self.user_id
            answer.answered_at = datetime.utcnow()
            answer.state = "done"
            saved.append(answer)
        assignment.write_uid = self.user_id
        self.db.commit()
        return saved

    def complete_assignment(self, employee_assignment_id: int) -> XEmployeeAssignment:
        assignment = self._get_assignment(employee_assignment_id)
        questions = self.db.query(XAssignmentQuestion).filter_by(company_id=self.company_id, template_id=assignment.template_id, active=True).all()
        answer_question_ids = {row.question_id for row in self.db.query(XAssignmentAnswer).filter_by(company_id=self.company_id, employee_assignment_id=assignment.id).all()}
        missing = [question.name for question in questions if question.required and question.id not in answer_question_ids]
        if missing:
            raise HTTPException(status_code=422, detail="Faltan respuestas requeridas: " + ", ".join(missing))
        needs_validation = any(question.requires_supervisor_validation for question in questions)
        assignment.state = "validation_pending" if needs_validation else "completed"
        assignment.write_uid = self.user_id
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def validate_assignment(self, employee_assignment_id: int, supervisor_pin: str, notes: str | None = None) -> XEmployeeAssignment:
        assignment = self._get_assignment(employee_assignment_id)
        validation_service = SupervisorValidationService(self.db, self.company_id)
        supervisor = validation_service.validate_supervisor_pin(supervisor_pin)
        validation_service.check_supervisor_permission(supervisor, "attendance.edit_team")
        validation = XAssignmentValidation(
            company_id=self.company_id,
            employee_assignment_id=assignment.id,
            supervisor_id=supervisor.id,
            method="supervisor_pin",
            result="approved",
            notes=notes,
            create_uid=supervisor.id,
            write_uid=supervisor.id,
        )
        self.db.add(validation)
        assignment.state = "validated"
        assignment.write_uid = supervisor.id
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def reject_assignment(self, employee_assignment_id: int, supervisor_pin: str, notes: str | None = None) -> XEmployeeAssignment:
        assignment = self._get_assignment(employee_assignment_id)
        validation_service = SupervisorValidationService(self.db, self.company_id)
        supervisor = validation_service.validate_supervisor_pin(supervisor_pin)
        validation_service.check_supervisor_permission(supervisor, "attendance.edit_team")
        self.db.add(XAssignmentValidation(company_id=self.company_id, employee_assignment_id=assignment.id, supervisor_id=supervisor.id, method="supervisor_pin", result="rejected", notes=notes, create_uid=supervisor.id, write_uid=supervisor.id))
        assignment.state = "rejected"
        assignment.write_uid = supervisor.id
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def set_task_completed(self, employee_assignment_id: int, question_id: int, completed: bool) -> XEmployeeAssignment:
        assignment = self._get_assignment(employee_assignment_id)
        if assignment.state in COMPLETED_STATES:
            raise HTTPException(status_code=400, detail="La asignacion ya esta completada")
        question = self.db.get(XAssignmentQuestion, question_id)
        if not question or question.company_id != self.company_id or question.template_id != assignment.template_id or not question.active:
            raise HTTPException(status_code=404, detail="Tarea no encontrada")

        if completed:
            self.save_assignment_answers(employee_assignment_id, [
                AssignmentAnswerIn(question_id=question_id, answer_boolean=True),
            ])
            assignment = self._get_assignment(employee_assignment_id)
            unanswered = self._unanswered_required(assignment)
            if not unanswered:
                return self.complete_assignment(employee_assignment_id)
            return assignment

        answer = self.db.query(XAssignmentAnswer).filter_by(
            company_id=self.company_id,
            employee_assignment_id=assignment.id,
            question_id=question.id,
        ).first()
        if answer:
            self.db.delete(answer)
            self.db.flush()
        remaining = (
            self.db.query(XAssignmentAnswer)
            .filter_by(company_id=self.company_id, employee_assignment_id=assignment.id)
            .count()
        )
        assignment.state = "in_progress" if remaining else "pending"
        assignment.write_uid = self.user_id
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def _unanswered_required(self, assignment: XEmployeeAssignment) -> list[str]:
        questions = self.db.query(XAssignmentQuestion).filter_by(
            company_id=self.company_id, template_id=assignment.template_id, active=True,
        ).all()
        answered_ids = {
            row.question_id
            for row in self.db.query(XAssignmentAnswer).filter_by(
                company_id=self.company_id, employee_assignment_id=assignment.id,
            ).all()
        }
        return [question.name for question in questions if question.required and question.id not in answered_ids]

    def _get_assignment(self, employee_assignment_id: int) -> XEmployeeAssignment:
        assignment = self.db.get(XEmployeeAssignment, employee_assignment_id)
        if not assignment or assignment.company_id != self.company_id:
            raise HTTPException(status_code=404, detail="Asignacion no encontrada")
        return assignment
