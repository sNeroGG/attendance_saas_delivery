from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrEmployee, ResUser, XAssignmentAnswer, XAssignmentQuestion, XAssignmentTemplate, XEmployeeAssignment
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.assignments import (
    AssignmentQuestionIn,
    AssignmentQuestionOut,
    AssignmentTemplateIn,
    AssignmentTemplateOut,
    EmployeeAssignmentIn,
    EmployeeAssignmentOut,
    KioskAssignmentOut,
    KioskTaskToggleIn,
    SaveAssignmentAnswersRequest,
    SupervisorValidationRequest,
    TemplateTaskIn,
)
from app.security.auth import get_current_user
from app.security.kiosk_session import require_kiosk_employee
from app.services.assignments import AssignmentService

router = APIRouter(tags=["assignments"])


def serialize_template(db: Session, record: XAssignmentTemplate) -> dict:
    questions = (
        db.query(XAssignmentQuestion)
        .filter_by(company_id=record.company_id, template_id=record.id, active=True)
        .order_by(XAssignmentQuestion.sequence, XAssignmentQuestion.id)
        .all()
    )
    return {
        "id": record.id,
        "company_id": record.company_id,
        "name": record.name,
        "description": record.description,
        "state": record.state,
        "active": record.active,
        "tasks": [
            {"id": item.id, "name": item.name, "description": item.question_text, "sequence": item.sequence}
            for item in questions
        ],
    }


def sync_template_tasks(db: Session, template: XAssignmentTemplate, tasks: list[TemplateTaskIn], user_id: int) -> None:
    existing = db.query(XAssignmentQuestion).filter_by(company_id=template.company_id, template_id=template.id).all()
    for question in existing:
        question.active = False
        question.write_uid = user_id
    for index, task in enumerate(tasks):
        name = (task.name or "").strip()
        if not name:
            continue
        db.add(XAssignmentQuestion(
            company_id=template.company_id,
            template_id=template.id,
            name=name,
            question_text=(task.description or "").strip() or name,
            question_type="boolean",
            required=True,
            sequence=(index + 1) * 10,
            create_uid=user_id,
            write_uid=user_id,
        ))


def serialize_assignment(db: Session, record: XEmployeeAssignment) -> XEmployeeAssignment:
    template = db.get(XAssignmentTemplate, record.template_id)
    employee = db.get(HrEmployee, record.employee_id)
    record.template_name = template.name if template else None
    record.employee_name = employee.name if employee else None
    return record


def serialize_kiosk_assignment(db: Session, record: XEmployeeAssignment) -> dict:
    serialize_assignment(db, record)
    questions = (
        db.query(XAssignmentQuestion)
        .filter_by(company_id=record.company_id, template_id=record.template_id, active=True)
        .order_by(XAssignmentQuestion.sequence, XAssignmentQuestion.id)
        .all()
    )
    answers = {
        item.question_id: item
        for item in db.query(XAssignmentAnswer).filter_by(
            company_id=record.company_id, employee_assignment_id=record.id,
        ).all()
    }
    tasks = []
    for question in questions:
        answer = answers.get(question.id)
        description = (question.question_text or "").strip()
        tasks.append({
            "id": question.id,
            "name": question.name,
            "description": description if description and description != question.name else None,
            "sequence": question.sequence,
            "completed": bool(answer and (answer.answer_boolean is True or answer.state == "done")),
        })
    return {
        "id": record.id,
        "company_id": record.company_id,
        "employee_id": record.employee_id,
        "shift_id": record.shift_id,
        "template_id": record.template_id,
        "assigned_at": record.assigned_at,
        "due_at": record.due_at,
        "required": record.required,
        "blocks_check_in": record.blocks_check_in,
        "blocks_check_out": record.blocks_check_out,
        "state": record.state,
        "applied_rule_id": record.applied_rule_id,
        "template_name": record.template_name,
        "employee_name": record.employee_name,
        "tasks": tasks,
    }


@router.get("/assignment-templates", response_model=list[AssignmentTemplateOut])
def list_templates(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    records = company_query(db, XAssignmentTemplate, user).order_by(XAssignmentTemplate.name).all()
    return [serialize_template(db, record) for record in records]


@router.post("/assignment-templates", response_model=AssignmentTemplateOut)
def create_template(payload: AssignmentTemplateIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    data = payload.model_dump()
    data.pop("tasks", [])
    record = XAssignmentTemplate(**data, company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.flush()
    sync_template_tasks(db, record, payload.tasks, user.id)
    db.commit()
    db.refresh(record)
    return serialize_template(db, record)


@router.get("/assignment-templates/{record_id}", response_model=AssignmentTemplateOut)
def get_template(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return serialize_template(db, get_company_record(db, XAssignmentTemplate, record_id, user))


@router.put("/assignment-templates/{record_id}", response_model=AssignmentTemplateOut)
def update_template(record_id: int, payload: AssignmentTemplateIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XAssignmentTemplate, record_id, user)
    data = to_dict(payload)
    data.pop("tasks", None)
    apply_values(record, data, user.id)
    if "tasks" in payload.model_fields_set:
        sync_template_tasks(db, record, payload.tasks, user.id)
    db.commit()
    db.refresh(record)
    return serialize_template(db, record)


@router.post("/assignment-templates/{record_id}/archive", response_model=AssignmentTemplateOut)
def archive_template(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XAssignmentTemplate, record_id, user)
    record.state = "archived"
    record.active = False
    record.write_uid = user.id
    db.commit()
    db.refresh(record)
    return serialize_template(db, record)


@router.get("/assignment-templates/{record_id}/questions", response_model=list[AssignmentQuestionOut])
def list_questions(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    get_company_record(db, XAssignmentTemplate, record_id, user)
    return db.query(XAssignmentQuestion).filter_by(company_id=user.company_id, template_id=record_id).order_by(XAssignmentQuestion.sequence, XAssignmentQuestion.id).all()


@router.post("/assignment-templates/{record_id}/questions", response_model=AssignmentQuestionOut)
def create_question(record_id: int, payload: AssignmentQuestionIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    get_company_record(db, XAssignmentTemplate, record_id, user)
    record = XAssignmentQuestion(**payload.model_dump(), company_id=user.company_id, template_id=record_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/assignment-questions/{record_id}", response_model=AssignmentQuestionOut)
def update_question(record_id: int, payload: AssignmentQuestionIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XAssignmentQuestion, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record


@router.post("/assignment-questions/{record_id}/disable", response_model=AssignmentQuestionOut)
def disable_question(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XAssignmentQuestion, record_id, user)
    record.active = False
    record.write_uid = user.id
    db.commit()
    db.refresh(record)
    return record


@router.get("/kiosk/employees/{employee_id}/assignments", response_model=list[KioskAssignmentOut])
def kiosk_employee_assignments(
    employee_id: int,
    shift_id: int | None = None,
    db: Session = Depends(get_db),
    user: ResUser = Depends(get_current_user),
):
    require_kiosk_employee(db, user, employee_id)
    employee = db.get(HrEmployee, employee_id)
    if not employee or employee.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    records = AssignmentService(db, user.company_id).get_pending_assignments(employee_id, shift_id)
    return [serialize_kiosk_assignment(db, record) for record in records]


@router.post("/kiosk/employee-assignments/{record_id}/tasks/{question_id}", response_model=KioskAssignmentOut)
def kiosk_toggle_task(
    record_id: int,
    question_id: int,
    payload: KioskTaskToggleIn,
    db: Session = Depends(get_db),
    user: ResUser = Depends(get_current_user),
):
    record = db.get(XEmployeeAssignment, record_id)
    if not record or record.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Asignacion no encontrada")
    require_kiosk_employee(db, user, record.employee_id)
    updated = AssignmentService(db, user.company_id, user.id).set_task_completed(record_id, question_id, payload.completed)
    return serialize_kiosk_assignment(db, updated)


@router.get("/employee-assignments", response_model=list[EmployeeAssignmentOut])
def list_employee_assignments(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    records = company_query(db, XEmployeeAssignment, user).order_by(XEmployeeAssignment.assigned_at.desc()).limit(300).all()
    return [serialize_assignment(db, record) for record in records]


@router.get("/employee-assignments/{record_id}", response_model=EmployeeAssignmentOut)
def get_employee_assignment(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return serialize_assignment(db, get_company_record(db, XEmployeeAssignment, record_id, user))


@router.post("/employee-assignments/{record_id}/answers")
def save_answers(record_id: int, payload: SaveAssignmentAnswersRequest, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    AssignmentService(db, user.company_id, user.id).save_assignment_answers(record_id, payload.answers)
    return {"ok": True}


@router.post("/employee-assignments/{record_id}/complete", response_model=EmployeeAssignmentOut)
def complete_assignment(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return AssignmentService(db, user.company_id, user.id).complete_assignment(record_id)


@router.post("/employee-assignments/{record_id}/validate-supervisor", response_model=EmployeeAssignmentOut)
def validate_assignment(record_id: int, payload: SupervisorValidationRequest, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return AssignmentService(db, user.company_id, user.id).validate_assignment(record_id, payload.supervisor_pin, payload.notes)


@router.post("/employee-assignments/{record_id}/reject", response_model=EmployeeAssignmentOut)
def reject_assignment(record_id: int, payload: SupervisorValidationRequest, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return AssignmentService(db, user.company_id, user.id).reject_assignment(record_id, payload.supervisor_pin, payload.notes)


@router.post("/employee-assignments", response_model=EmployeeAssignmentOut)
def create_employee_assignment(payload: EmployeeAssignmentIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = XEmployeeAssignment(
        company_id=user.company_id,
        employee_id=payload.employee_id,
        template_id=payload.template_id,
        required=payload.required,
        blocks_check_in=payload.blocks_check_in,
        blocks_check_out=payload.blocks_check_out,
        state=payload.state,
        create_uid=user.id,
        write_uid=user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return serialize_assignment(db, record)


@router.put("/employee-assignments/{record_id}", response_model=EmployeeAssignmentOut)
def update_employee_assignment(record_id: int, payload: EmployeeAssignmentIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XEmployeeAssignment, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return serialize_assignment(db, record)
