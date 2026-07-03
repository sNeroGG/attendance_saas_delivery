from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrJob, ResUser
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.core import JobIn, JobOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, HrJob, user).order_by(HrJob.name).all()


@router.post("", response_model=JobOut)
def create_job(payload: JobIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = HrJob(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=JobOut)
def get_job(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, HrJob, record_id, user)


@router.put("/{record_id}", response_model=JobOut)
def update_job(record_id: int, payload: JobIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, HrJob, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record
