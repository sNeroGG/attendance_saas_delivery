from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.core import UserCreate, UserOut, UserUpdate
from app.security.auth import get_current_user, hash_secret

router = APIRouter(prefix="/users", tags=["users"])


def serialize_user(user: ResUser) -> ResUser:
    return user


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, ResUser, user).order_by(ResUser.name).all()


@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    values = payload.model_dump(exclude={"password", "pin"})
    record = ResUser(
        **values,
        company_id=user.company_id,
        password_hash=hash_secret(payload.password) if payload.password else hash_secret("default_dummy_password_123"),
        pin_hash=hash_secret(payload.pin) if payload.pin else None,
        create_uid=user.id,
        write_uid=user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=UserOut)
def get_user(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, ResUser, record_id, user)


@router.put("/{record_id}", response_model=UserOut)
def update_user(record_id: int, payload: UserUpdate, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
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
