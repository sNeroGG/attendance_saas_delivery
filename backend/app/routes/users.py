from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrEmployee, ResUser
from app.routes.common import apply_values, company_query, get_company_record, require_company_admin, to_dict
from app.schemas.core import UserCreate, UserOut, UserUpdate
from app.schemas.phase4 import LedgerOut
from app.security.auth import get_current_user, hash_secret
from app.config import get_settings
from app.services.employee_defaults import apply_employee_defaults
from app.services.ledger import employee_ledger

router = APIRouter(prefix="/users", tags=["users"])


def serialize_user(user: ResUser) -> ResUser:
    return user


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    return company_query(db, ResUser, user).order_by(ResUser.name).all()


@router.get("/{record_id}/ledger", response_model=LedgerOut)
def get_user_ledger(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    record = get_company_record(db, ResUser, record_id, user)
    employee_id = record.employee_id
    if not employee_id:
        employee = db.query(HrEmployee).filter_by(company_id=user.company_id, user_id=record.id).first()
        employee_id = employee.id if employee else None
    if not employee_id:
        raise HTTPException(status_code=404, detail="Este usuario no tiene bitácora de empleado")
    return employee_ledger(db, user.company_id, employee_id)


@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    if payload.is_superadmin and not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Solo un superadmin puede crear otro superadmin")
    if get_settings().environment.lower() == "production":
        if not payload.password or len(payload.password) < 14:
            raise HTTPException(status_code=422, detail="En producción la contraseña debe tener al menos 14 caracteres")
        if payload.pin and (len(payload.pin) < 6 or not payload.pin.isdigit()):
            raise HTTPException(status_code=422, detail="En producción el PIN debe tener al menos 6 dígitos numéricos")
    values = payload.model_dump(exclude={"password", "pin", "create_employee", "job_title"})
    record = ResUser(
        **values,
        company_id=user.company_id,
        password_hash=hash_secret(payload.password),
        pin_hash=hash_secret(payload.pin) if payload.pin else None,
        create_uid=user.id,
        write_uid=user.id,
    )
    db.add(record)
    db.flush()

    if payload.create_employee and not record.employee_id:
        employee_data = apply_employee_defaults(db, user.company_id, user.id, {
            "name": record.name,
            "work_email": record.email,
            "job_title": payload.job_title,
            "create_user_profile": False,
        })
        employee_data.pop("create_user_profile", None)
        employee_data.pop("user_login", None)
        employee_data.pop("user_pin", None)
        employee_data.pop("user_password", None)
        employee_data.pop("task_template_ids", None)
        employee_data.pop("role_id", None)
        employee = HrEmployee(
            **employee_data,
            company_id=user.company_id,
            user_id=record.id,
            create_uid=user.id,
            write_uid=user.id,
        )
        db.add(employee)
        db.flush()
        record.employee_id = employee.id

    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=UserOut)
def get_user(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    return get_company_record(db, ResUser, record_id, user)


@router.put("/{record_id}", response_model=UserOut)
def update_user(record_id: int, payload: UserUpdate, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    if payload.is_superadmin is True and not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Solo un superadmin puede asignar ese privilegio")
    if get_settings().environment.lower() == "production":
        if payload.password is not None and len(payload.password) < 14:
            raise HTTPException(status_code=422, detail="En producción la contraseña debe tener al menos 14 caracteres")
        if payload.pin is not None and (len(payload.pin) < 6 or not payload.pin.isdigit()):
            raise HTTPException(status_code=422, detail="En producción el PIN debe tener al menos 6 dígitos numéricos")
    record = get_company_record(db, ResUser, record_id, user)
    values = to_dict(payload, {"password", "pin"})
    apply_values(record, values, user.id)
    if payload.password:
        record.password_hash = hash_secret(payload.password)
    if payload.pin:
        record.pin_hash = hash_secret(payload.pin)
    db.commit()
    db.refresh(record)
    return record
