from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrDepartment, ResUser
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.core import DepartmentIn, DepartmentOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, HrDepartment, user).order_by(HrDepartment.name).all()


@router.post("", response_model=DepartmentOut)
def create_department(payload: DepartmentIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = HrDepartment(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=DepartmentOut)
def get_department(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, HrDepartment, record_id, user)


@router.put("/{record_id}", response_model=DepartmentOut)
def update_department(record_id: int, payload: DepartmentIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, HrDepartment, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record
