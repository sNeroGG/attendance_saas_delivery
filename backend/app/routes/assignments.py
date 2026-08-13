from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrEmployee, ResUser, XAssignmentQuestion, XAssignmentTemplate, XEmployeeAssignment
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.assignments import (
    AssignmentQuestionIn,
    AssignmentQuestionOut,
    AssignmentTemplateIn,
    AssignmentTemplateOut,
    EmployeeAssignmentIn,
    EmployeeAssignmentOut,
    SaveAssignmentAnswersRequest,
    SupervisorValidationRequest,
)
from app.security.auth import get_current_user
from app.services.assignments import AssignmentService

router = APIRouter(tags=["assignments"])


def serialize_assignment(db: Session, record: XEmployeeAssignment) -> XEmployeeAssignment:
    template = db.get(XAssignmentTemplate, record.template_id)
    employee = db.get(HrEmployee, record.employee_id)
    record.template_name = template.name if template else None
    record.employee_name = employee.name if employee else None
    return record


@router.get("/assignment-templates", response_model=list[AssignmentTemplateOut])
def list_templates(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XAssignmentTemplate, user).order_by(XAssignmentTemplate.name).all()


@router.post("/assignment-templates", response_model=AssignmentTemplateOut)
def create_template(payload: AssignmentTemplateIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = XAssignmentTemplate(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/assignment-templates/{record_id}", response_model=AssignmentTemplateOut)
def get_template(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, XAssignmentTemplate, record_id, user)


@router.put("/assignment-templates/{record_id}", response_model=AssignmentTemplateOut)
def update_template(record_id: int, payload: AssignmentTemplateIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XAssignmentTemplate, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record


@router.post("/assignment-templates/{record_id}/archive", response_model=AssignmentTemplateOut)
def archive_template(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XAssignmentTemplate, record_id, user)
    record.state = "archived"
    record.active = False
    record.write_uid = user.id
    db.commit()
    db.refresh(record)
    return record


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


@router.get("/kiosk/employees/{employee_id}/assignments", response_model=list[EmployeeAssignmentOut])
def kiosk_employee_assignments(employee_id: int, shift_id: int | None = None, db: Session = Depends(get_db)):
    assignment = db.query(XEmployeeAssignment).filter_by(employee_id=employee_id).order_by(XEmployeeAssignment.assigned_at.desc()).first()
    company_id = assignment.company_id if assignment else None
    if company_id is None:
        from app.models import HrEmployee
        employee = db.get(HrEmployee, employee_id)
        company_id = employee.company_id if employee else 0
    return AssignmentService(db, company_id).get_pending_assignments(employee_id, shift_id)


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
