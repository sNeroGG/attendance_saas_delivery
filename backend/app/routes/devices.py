from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser, XDevice
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.attendance import DeviceIn, DeviceOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=list[DeviceOut])
def list_devices(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XDevice, user).order_by(XDevice.name).all()


@router.post("", response_model=DeviceOut)
def create_device(payload: DeviceIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = XDevice(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=DeviceOut)
def get_device(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, XDevice, record_id, user)


@router.put("/{record_id}", response_model=DeviceOut)
def update_device(record_id: int, payload: DeviceIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XDevice, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    record.last_seen_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return record
