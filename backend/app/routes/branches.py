from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser, XBranch
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.core import BranchIn, BranchOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=list[BranchOut])
def list_branches(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XBranch, user).order_by(XBranch.name).all()


@router.post("", response_model=BranchOut)
def create_branch(payload: BranchIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = XBranch(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=BranchOut)
def get_branch(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, XBranch, record_id, user)


@router.put("/{record_id}", response_model=BranchOut)
def update_branch(record_id: int, payload: BranchIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XBranch, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record
