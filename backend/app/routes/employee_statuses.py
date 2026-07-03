from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser, XEmployeeStatus
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.core import EmployeeStatusIn, EmployeeStatusOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/employee-statuses", tags=["employee-statuses"])


@router.get("", response_model=list[EmployeeStatusOut])
def list_statuses(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XEmployeeStatus, user).order_by(XEmployeeStatus.name).all()


@router.post("", response_model=EmployeeStatusOut)
def create_status(payload: EmployeeStatusIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = XEmployeeStatus(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=EmployeeStatusOut)
def get_status(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, XEmployeeStatus, record_id, user)


@router.put("/{record_id}", response_model=EmployeeStatusOut)
def update_status(record_id: int, payload: EmployeeStatusIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XEmployeeStatus, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record
