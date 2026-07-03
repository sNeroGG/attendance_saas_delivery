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
    return company_query(db, HrEmployee, user).order_by(HrEmployee.name).all()


@router.post("", response_model=EmployeeOut)
def create_employee(payload: EmployeeIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = HrEmployee(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=EmployeeOut)
def get_employee(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, HrEmployee, record_id, user)


@router.put("/{record_id}", response_model=EmployeeOut)
def update_employee(record_id: int, payload: EmployeeIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, HrEmployee, record_id, user)
    apply_values(record, to_dict(payload), user.id)
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
