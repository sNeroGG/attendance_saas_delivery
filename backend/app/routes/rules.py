from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser, XRule
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.assignments import RuleIn, RuleOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("", response_model=list[RuleOut])
def list_rules(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XRule, user).order_by(XRule.priority, XRule.id).all()


@router.post("", response_model=RuleOut)
def create_rule(payload: RuleIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = XRule(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=RuleOut)
def get_rule(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, XRule, record_id, user)


@router.put("/{record_id}", response_model=RuleOut)
def update_rule(record_id: int, payload: RuleIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XRule, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record


@router.post("/{record_id}/disable", response_model=RuleOut)
def disable_rule(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XRule, record_id, user)
    record.active = False
    record.write_uid = user.id
    db.commit()
    db.refresh(record)
    return record
