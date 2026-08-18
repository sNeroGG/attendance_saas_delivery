from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import HrEmployee, ResUser


def session_employee_id(db: Session, user: ResUser) -> int | None:
    if user.employee_id:
        return user.employee_id
    employee = db.query(HrEmployee).filter_by(company_id=user.company_id, user_id=user.id, active=True).first()
    return employee.id if employee else None


def require_kiosk_employee(db: Session, user: ResUser, employee_id: int) -> int:
    current_id = session_employee_id(db, user)
    if current_id is None:
        raise HTTPException(status_code=403, detail="La sesion del kiosko no esta vinculada a un empleado")
    if current_id != employee_id:
        raise HTTPException(status_code=403, detail="Esta sesion pertenece a otro empleado")
    return current_id


def require_own_employee_or_admin(db: Session, user: ResUser, employee_id: int) -> None:
    if user.is_superadmin or user.is_company_admin:
        return
    require_kiosk_employee(db, user, employee_id)
