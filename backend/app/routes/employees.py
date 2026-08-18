from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrEmployee, ResUser, XAssignmentTemplate, XEmployeeAssignment, XEmployeeRole, XEmployeeStatusHistory, XFaceTemplate, XRole
from app.routes.common import apply_values, company_query, get_company_record
from app.schemas.core import AssignRoleRequest, ChangeStatusRequest, EmployeeIn, EmployeeOut
from app.schemas.phase4 import LedgerOut
from app.security.auth import get_current_user
from app.services.employee_defaults import apply_employee_defaults, assign_templates
from app.services.ledger import employee_ledger
from app.services.operational_day import COMPLETED_TASK_STATES, as_local
from app.services.schedules import employee_role_id, employee_role_name, resolve_employee_schedule, sync_employee_role, window_for_date

router = APIRouter(prefix="/employees", tags=["employees"])


def populate_employee_user_fields(db: Session, employee: HrEmployee) -> HrEmployee:
    user = None
    if employee.user_id:
        user = db.get(ResUser, employee.user_id)
    else:
        user = db.query(ResUser).filter_by(employee_id=employee.id, active=True).first()
        
    if user:
        employee.user_login = user.login
        employee.user_pin = user.pin_plain
        employee.create_user_profile = True
        if not employee.user_id:
            employee.user_id = user.id
    else:
        employee.user_login = None
        employee.user_pin = None
        employee.create_user_profile = False

    # Cargar foto base de Face ID
    template = db.query(XFaceTemplate).filter_by(employee_id=employee.id, active=True).first()
    employee.face_image = template.face_encoding if template else None
    employee.role_id = employee_role_id(db, employee.id)
    employee.role_name = employee_role_name(db, employee.company_id, employee.id)
    return employee


@router.get("", response_model=list[EmployeeOut])
def list_employees(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    employees = company_query(db, HrEmployee, user).order_by(HrEmployee.name).all()
    for emp in employees:
        populate_employee_user_fields(db, emp)
    return employees


@router.get("/{record_id}/ledger", response_model=LedgerOut)
def get_employee_ledger(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    get_company_record(db, HrEmployee, record_id, user)
    return employee_ledger(db, user.company_id, record_id)


@router.get("/{record_id}/task-calendar")
def employee_task_calendar(
    record_id: int,
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: ResUser = Depends(get_current_user),
):
    employee = get_company_record(db, HrEmployee, record_id, user)
    today = as_local().date()
    start = start or (today - timedelta(days=today.weekday()))
    end = end or (start + timedelta(days=6))
    if end < start:
        start, end = end, start
    schedule, source = resolve_employee_schedule(db, user.company_id, employee)
    templates = {item.id: item.name for item in db.query(XAssignmentTemplate).filter_by(company_id=user.company_id).all()}
    assignments = (
        db.query(XEmployeeAssignment)
        .filter(
            XEmployeeAssignment.company_id == user.company_id,
            XEmployeeAssignment.employee_id == employee.id,
        )
        .order_by(XEmployeeAssignment.assigned_at)
        .all()
    )
    days = []
    cursor = start
    while cursor <= end:
        window = window_for_date(db, schedule, cursor)
        day_tasks = []
        for item in assignments:
            assigned_day = as_local(item.assigned_at).date() if item.assigned_at else None
            due_day = as_local(item.due_at).date() if item.due_at else None
            if assigned_day == cursor or due_day == cursor:
                day_tasks.append({
                    "id": item.id,
                    "name": templates.get(item.template_id, f"#{item.template_id}"),
                    "state": item.state,
                    "required": item.required,
                    "assigned_at": item.assigned_at,
                    "due_at": item.due_at,
                    "done": item.state in COMPLETED_TASK_STATES,
                })
        days.append({
            "date": cursor.isoformat(),
            "weekday": cursor.weekday(),
            "is_off": window["is_off"],
            "schedule_label": window["label"],
            "tasks": day_tasks,
        })
        cursor += timedelta(days=1)
    return {
        "employee": {
            "id": employee.id,
            "name": employee.name,
            "employee_code": employee.employee_code,
            "role_name": employee_role_name(db, user.company_id, employee.id),
            "schedule_name": schedule.name if schedule else None,
            "schedule_source": source,
        },
        "start": start.isoformat(),
        "end": end.isoformat(),
        "days": days,
    }


@router.post("", response_model=EmployeeOut)
def create_employee(payload: EmployeeIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    data = payload.model_dump()
    task_template_ids = data.pop("task_template_ids", []) or []
    role_id = data.pop("role_id", None)
    data = apply_employee_defaults(db, user.company_id, user.id, data)
    create_user_profile = data.pop("create_user_profile", True)
    user_login = data.pop("user_login", None)
    user_pin = data.pop("user_pin", None)

    record = HrEmployee(**data, company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.flush()

    if create_user_profile:
        login_name = user_login or record.employee_code or f"user_{record.id}"
        # Validar login único para evitar duplicados
        existing_user = db.query(ResUser).filter_by(company_id=user.company_id, login=login_name).first()
        if existing_user:
            login_name = f"{login_name}_{record.id}"
        
        from app.security.auth import hash_secret
        new_user = ResUser(
            company_id=user.company_id,
            employee_id=record.id,
            name=record.name,
            login=login_name,
            email=record.work_email,
            password_hash=hash_secret("default_dummy_password_123"),
            pin_hash=hash_secret(user_pin) if user_pin else None,
            pin_plain=user_pin,
            create_uid=user.id,
            write_uid=user.id,
        )
        db.add(new_user)
        db.flush()
        record.user_id = new_user.id

    if task_template_ids:
        assign_templates(db, user.company_id, user.id, record.id, task_template_ids)

    if role_id:
        role = db.get(XRole, role_id)
        if role and role.company_id == user.company_id:
            sync_employee_role(db, record.id, role.id, user.id)

    db.commit()
    db.refresh(record)
    populate_employee_user_fields(db, record)
    return record


@router.get("/{record_id}", response_model=EmployeeOut)
def get_employee(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    emp = get_company_record(db, HrEmployee, record_id, user)
    populate_employee_user_fields(db, emp)
    return emp


@router.put("/{record_id}", response_model=EmployeeOut)
def update_employee(record_id: int, payload: EmployeeIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, HrEmployee, record_id, user)
    data = payload.model_dump(exclude_unset=True)
    data.pop("task_template_ids", None)
    role_id = data.pop("role_id", None)
    create_user_profile = data.pop("create_user_profile", False)
    user_login = data.pop("user_login", None)
    user_pin = data.pop("user_pin", None)

    apply_values(record, data, user.id)
    db.flush()

    associated_user = None
    if record.user_id:
        associated_user = db.get(ResUser, record.user_id)
    else:
        associated_user = db.query(ResUser).filter_by(employee_id=record.id, company_id=user.company_id).first()

    from app.security.auth import hash_secret
    if associated_user:
        # Update existing user profile
        if user_login:
            associated_user.login = user_login
        if user_pin:
            associated_user.pin_hash = hash_secret(user_pin)
            associated_user.pin_plain = user_pin
        associated_user.email = record.work_email
        associated_user.name = record.name
        associated_user.write_uid = user.id
        db.add(associated_user)
        db.flush()
        if not record.user_id:
            record.user_id = associated_user.id
    elif create_user_profile or user_login or user_pin:
        # Create a new user profile since it doesn't exist
        login_name = user_login or record.employee_code or f"user_{record.id}"
        # Validate unique login
        existing_user = db.query(ResUser).filter_by(company_id=user.company_id, login=login_name).first()
        if existing_user:
            login_name = f"{login_name}_{record.id}"
            
        new_user = ResUser(
            company_id=user.company_id,
            employee_id=record.id,
            name=record.name,
            login=login_name,
            email=record.work_email,
            password_hash=hash_secret("default_dummy_password_123"),
            pin_hash=hash_secret(user_pin) if user_pin else None,
            pin_plain=user_pin,
            create_uid=user.id,
            write_uid=user.id,
        )
        db.add(new_user)
        db.flush()
        record.user_id = new_user.id

    if "role_id" in payload.model_fields_set:
        if role_id:
            role = db.get(XRole, role_id)
            if not role or role.company_id != user.company_id:
                role_id = None
        sync_employee_role(db, record.id, role_id, user.id)

    db.commit()
    db.refresh(record)
    populate_employee_user_fields(db, record)
    return record


@router.post("/{record_id}/change-status", response_model=EmployeeOut)
def change_status(record_id: int, payload: ChangeStatusRequest, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    employee = get_company_record(db, HrEmployee, record_id, user)
    history = XEmployeeStatusHistory(
        company_id=user.company_id,
        employee_id=employee.id,
        old_status_id=employee.employment_status_id,
        new_status_id=payload.new_status_id,
        reason=payload.reason,
        changed_by=user.id,
        create_uid=user.id,
        write_uid=user.id,
    )
    employee.employment_status_id = payload.new_status_id
    employee.write_uid = user.id
    db.add(history)
    db.commit()
    db.refresh(employee)
    return employee


@router.post("/{record_id}/assign-role")
def assign_role(record_id: int, payload: AssignRoleRequest, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    employee = get_company_record(db, HrEmployee, record_id, user)
    exists = db.query(XEmployeeRole).filter_by(employee_id=employee.id, role_id=payload.role_id).first()
    if not exists:
        db.add(XEmployeeRole(employee_id=employee.id, role_id=payload.role_id, create_uid=user.id))
        db.commit()
    return {"ok": True}


@router.delete("/{record_id}/face")
def delete_employee_face(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    employee = get_company_record(db, HrEmployee, record_id, user)
    template = db.query(XFaceTemplate).filter_by(company_id=user.company_id, employee_id=employee.id, active=True).first()
    if template:
        template.active = False
        db.commit()
    return {"ok": True}
