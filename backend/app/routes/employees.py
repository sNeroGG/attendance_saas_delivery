from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrEmployee, ResUser, XEmployeeRole, XEmployeeStatusHistory
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.core import AssignRoleRequest, ChangeStatusRequest, EmployeeIn, EmployeeOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[EmployeeOut])
def list_employees(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    employees = company_query(db, HrEmployee, user).order_by(HrEmployee.name).all()
    return employees


@router.post("", response_model=EmployeeOut)
def create_employee(payload: EmployeeIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    data = payload.model_dump()
    create_user_profile = data.pop("create_user_profile", False)
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
            create_uid=user.id,
            write_uid=user.id,
        )
        db.add(new_user)
        db.flush()
        record.user_id = new_user.id

    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=EmployeeOut)
def get_employee(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    emp = get_company_record(db, HrEmployee, record_id, user)
    return emp


@router.put("/{record_id}", response_model=EmployeeOut)
def update_employee(record_id: int, payload: EmployeeIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, HrEmployee, record_id, user)
    data = payload.model_dump()
    data.pop("create_user_profile", None)
    data.pop("user_login", None)
    data.pop("user_pin", None)
    apply_values(record, data, user.id)
    db.commit()
    db.refresh(record)
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
