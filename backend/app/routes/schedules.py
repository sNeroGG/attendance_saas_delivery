from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrEmployee, ResUser, XRole, XWorkSchedule
from app.routes.common import get_company_record
from app.schemas.schedules import (
    EmployeeScheduleOut,
    RoleScheduleOut,
    ScheduleAssignmentIn,
    WorkScheduleIn,
    WorkScheduleOut,
    WorkScheduleOverviewOut,
)
from app.security.auth import get_current_user
from app.services.schedules import (
    employee_role_name,
    ensure_default_schedule,
    resolve_employee_schedule,
    serialize_schedule,
    set_default_schedule,
    sync_schedule_lines,
)

router = APIRouter(prefix="/work-schedules", tags=["work-schedules"])


@router.get("", response_model=list[WorkScheduleOut])
def list_schedules(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    ensure_default_schedule(db, user.company_id, user.id)
    db.commit()
    records = db.query(XWorkSchedule).filter_by(company_id=user.company_id).order_by(XWorkSchedule.is_default.desc(), XWorkSchedule.name).all()
    return [serialize_schedule(db, record) for record in records]


@router.get("/overview", response_model=WorkScheduleOverviewOut)
def schedule_overview(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    default = ensure_default_schedule(db, user.company_id, user.id)
    db.commit()
    schedules = db.query(XWorkSchedule).filter_by(company_id=user.company_id).order_by(XWorkSchedule.is_default.desc(), XWorkSchedule.name).all()
    roles = db.query(XRole).filter_by(company_id=user.company_id).order_by(XRole.name).all()
    employees = db.query(HrEmployee).filter_by(company_id=user.company_id, active=True).order_by(HrEmployee.name).all()
    schedule_names = {item.id: item.name for item in schedules}
    role_out: list[RoleScheduleOut] = []
    for role in roles:
        role_out.append(RoleScheduleOut(
            id=role.id,
            name=role.name,
            schedule_id=role.schedule_id,
            schedule_name=schedule_names.get(role.schedule_id) if role.schedule_id else None,
        ))
    employee_out: list[EmployeeScheduleOut] = []
    for employee in employees:
        resolved, source = resolve_employee_schedule(db, user.company_id, employee)
        employee_out.append(EmployeeScheduleOut(
            id=employee.id,
            name=employee.name,
            employee_code=employee.employee_code,
            job_title=employee.job_title,
            role_name=employee_role_name(db, user.company_id, employee.id),
            schedule_id=employee.schedule_id,
            resolved_schedule_id=resolved.id if resolved else None,
            resolved_schedule_name=resolved.name if resolved else None,
            source=source,
        ))
    return {
        "default_schedule_id": default.id,
        "schedules": [serialize_schedule(db, record) for record in schedules],
        "roles": role_out,
        "employees": employee_out,
    }


@router.post("", response_model=WorkScheduleOut)
def create_schedule(payload: WorkScheduleIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    ensure_default_schedule(db, user.company_id, user.id)
    record = XWorkSchedule(
        company_id=user.company_id,
        name=payload.name.strip(),
        description=payload.description,
        timezone=payload.timezone,
        active=payload.active,
        is_default=False,
        create_uid=user.id,
        write_uid=user.id,
    )
    db.add(record)
    db.flush()
    sync_schedule_lines(db, record, payload.lines, user.id)
    if payload.is_default:
        set_default_schedule(db, user.company_id, record, user.id)
    db.commit()
    db.refresh(record)
    return serialize_schedule(db, record)


@router.put("/{record_id}", response_model=WorkScheduleOut)
def update_schedule(record_id: int, payload: WorkScheduleIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XWorkSchedule, record_id, user)
    record.name = payload.name.strip()
    record.description = payload.description
    record.timezone = payload.timezone
    record.active = payload.active
    record.write_uid = user.id
    if "lines" in payload.model_fields_set:
        sync_schedule_lines(db, record, payload.lines, user.id)
    if payload.is_default:
        set_default_schedule(db, user.company_id, record, user.id)
    db.commit()
    db.refresh(record)
    return serialize_schedule(db, record)


@router.post("/{record_id}/set-default", response_model=WorkScheduleOut)
def mark_default(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XWorkSchedule, record_id, user)
    set_default_schedule(db, user.company_id, record, user.id)
    db.commit()
    db.refresh(record)
    return serialize_schedule(db, record)


@router.put("/roles/{role_id}", response_model=RoleScheduleOut)
def assign_role_schedule(role_id: int, payload: ScheduleAssignmentIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    role = get_company_record(db, XRole, role_id, user)
    if payload.schedule_id:
        schedule = get_company_record(db, XWorkSchedule, payload.schedule_id, user)
        role.schedule_id = schedule.id
    else:
        role.schedule_id = None
    role.write_uid = user.id
    db.commit()
    db.refresh(role)
    schedule = db.get(XWorkSchedule, role.schedule_id) if role.schedule_id else None
    return RoleScheduleOut(id=role.id, name=role.name, schedule_id=role.schedule_id, schedule_name=schedule.name if schedule else None)


@router.put("/employees/{employee_id}", response_model=EmployeeScheduleOut)
def assign_employee_schedule(employee_id: int, payload: ScheduleAssignmentIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    employee = get_company_record(db, HrEmployee, employee_id, user)
    if payload.schedule_id:
        schedule = get_company_record(db, XWorkSchedule, payload.schedule_id, user)
        employee.schedule_id = schedule.id
    else:
        employee.schedule_id = None
    employee.write_uid = user.id
    db.commit()
    db.refresh(employee)
    resolved, source = resolve_employee_schedule(db, user.company_id, employee)
    return EmployeeScheduleOut(
        id=employee.id,
        name=employee.name,
        employee_code=employee.employee_code,
        job_title=employee.job_title,
        role_name=employee_role_name(db, user.company_id, employee.id),
        schedule_id=employee.schedule_id,
        resolved_schedule_id=resolved.id if resolved else None,
        resolved_schedule_name=resolved.name if resolved else None,
        source=source,
    )
