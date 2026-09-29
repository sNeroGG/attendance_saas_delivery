from sqlalchemy.orm import Session

from app.models import (
    HrEmployee,
    XAssignmentAnswer,
    XAssignmentQuestion,
    XAssignmentTemplate,
    XAttendanceEvent,
    XAttendanceEventType,
    XAuditLog,
    XEmployeeAssignment,
    XBiometricLog,
)
from app.services.operational_day import KIND_LABELS


ASSIGNMENT_STATE_LABELS = {
    "pending": "Pendiente de completar",
    "in_progress": "En progreso",
    "completed": "Completado",
    "validated": "Validado",
    "validation_pending": "Por validar supervisor",
    "rejected": "Rechazado",
}


def employee_ledger(db: Session, company_id: int, employee_id: int) -> dict:
    employee = db.query(HrEmployee).filter_by(id=employee_id, company_id=company_id).first()
    if not employee:
        return {"employee": None, "entries": []}

    entries: list[dict] = []

    events = (
        db.query(XAttendanceEvent)
        .filter_by(company_id=company_id, employee_id=employee_id)
        .order_by(XAttendanceEvent.timestamp.desc())
        .limit(200)
        .all()
    )
    for event in events:
        event_type = db.get(XAttendanceEventType, event.event_type_id)
        title = event_type.name if event_type else "Evento de asistencia"
        entries.append({
            "at": event.timestamp,
            "kind": "attendance",
            "kind_label": KIND_LABELS["attendance"],
            "title": title,
            "detail": f"{event.method or 'pin'} · {event.source or 'kiosk'}",
            "state": event.state,
        })

    assignments = (
        db.query(XEmployeeAssignment)
        .filter_by(company_id=company_id, employee_id=employee_id)
        .order_by(XEmployeeAssignment.assigned_at.desc())
        .limit(200)
        .all()
    )
    assignment_ids = [item.id for item in assignments]
    templates = {item.id: item.name for item in db.query(XAssignmentTemplate).filter(XAssignmentTemplate.id.in_([a.template_id for a in assignments] or [0])).all()}
    for assignment in assignments:
        template_name = templates.get(assignment.template_id, f"Checklist #{assignment.template_id}")
        entries.append({
            "at": assignment.assigned_at,
            "kind": "task",
            "kind_label": KIND_LABELS["task"],
            "title": f"Checklist asignado: {template_name}",
            "detail": ASSIGNMENT_STATE_LABELS.get(assignment.state, assignment.state),
            "state": assignment.state,
        })

    if assignment_ids:
        answers = (
            db.query(XAssignmentAnswer)
            .filter(XAssignmentAnswer.company_id == company_id, XAssignmentAnswer.employee_assignment_id.in_(assignment_ids))
            .order_by(XAssignmentAnswer.answered_at.desc())
            .limit(200)
            .all()
        )
        assignment_by_id = {item.id: item for item in assignments}
        for answer in answers:
            if not answer.answered_at:
                continue
            question = db.get(XAssignmentQuestion, answer.question_id)
            assignment = assignment_by_id.get(answer.employee_assignment_id)
            template_name = templates.get(assignment.template_id, "") if assignment else ""
            if answer.answer_boolean is True or answer.state == "done":
                detail = "El empleado marcó que sí lo hizo"
            elif answer.answer_boolean is False:
                detail = "Marcado como no realizado"
            else:
                detail = answer.answer_text or answer.answer_json or (
                    str(answer.answer_number) if answer.answer_number is not None else "Sin detalle"
                )
            if template_name:
                detail = f"{template_name} · {detail}"
            entries.append({
                "at": answer.answered_at,
                "kind": "task_answer",
                "kind_label": KIND_LABELS["task_answer"],
                "title": question.name if question else "Ítem de checklist",
                "detail": detail,
                "state": answer.state,
            })

    logs = (
        db.query(XAuditLog)
        .filter_by(company_id=company_id, employee_id=employee_id)
        .order_by(XAuditLog.timestamp.desc())
        .limit(200)
        .all()
    )
    for log in logs:
        detail_parts = [part for part in [log.field_name, log.new_value, log.reason] if part]
        entries.append({
            "at": log.timestamp,
            "kind": "audit",
            "kind_label": KIND_LABELS["audit"],
            "title": log.action.replace("_", " ").title(),
            "detail": " · ".join(detail_parts) or log.model_name,
            "state": None,
        })

    biometrics = (
        db.query(XBiometricLog)
        .filter_by(company_id=company_id, employee_id=employee_id)
        .order_by(XBiometricLog.timestamp.desc())
        .limit(100)
        .all()
    )
    for item in biometrics:
        entries.append({
            "at": item.timestamp,
            "kind": "biometric",
            "kind_label": KIND_LABELS["biometric"],
            "title": "Identificación" if item.success else "Identificación fallida",
            "detail": item.method or "face",
            "state": "ok" if item.success else "error",
        })

    entries.sort(key=lambda item: item["at"] or item.get("title"), reverse=True)
    return {
        "employee": {
            "id": employee.id,
            "name": employee.name,
            "employee_code": employee.employee_code,
            "job_title": employee.job_title,
            "employee_type": employee.employee_type,
            "active": employee.active,
        },
        "entries": entries,
    }
