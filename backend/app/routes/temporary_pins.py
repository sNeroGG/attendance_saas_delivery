import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser, XManagerTemporaryPin
from app.schemas.core import ManagerTemporaryPinOut
from app.security.auth import get_current_user
from app.services.audit_log import AuditLogService

router = APIRouter(prefix="/temporary-pins", tags=["temporary-pins"])


@router.post("", response_model=ManagerTemporaryPinOut)
def generate_temporary_pin(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    # Verify permission
    from app.services.supervisor_validation import SupervisorValidationService
    try:
        SupervisorValidationService(db, user.company_id).check_supervisor_permission(user, "attendance.edit_team")
    except HTTPException:
        raise HTTPException(status_code=403, detail="No tiene permisos para generar un PIN temporal de gerente")

    # Generate a unique 6-digit PIN code (making sure it doesn't collide with another active temporary PIN)
    pin = ""
    for _ in range(10): # try 10 times to avoid collisions
        candidate = f"{random.randint(100000, 999999)}"
        exists = db.query(XManagerTemporaryPin).filter(
            XManagerTemporaryPin.company_id == user.company_id,
            XManagerTemporaryPin.pin == candidate,
            XManagerTemporaryPin.used_at.is_(None),
            XManagerTemporaryPin.expires_at > datetime.utcnow()
        ).first()
        if not exists:
            pin = candidate
            break

    if not pin:
        raise HTTPException(status_code=500, detail="No se pudo generar un PIN único. Intente de nuevo.")

    # Create the temporary PIN record
    record = XManagerTemporaryPin(
        company_id=user.company_id,
        pin=pin,
        created_by_user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(minutes=5),
    )
    db.add(record)
    db.flush()

    # Log in audit log
    AuditLogService(db, user.company_id).record(
        action="generate_temporary_pin",
        model_name="x_manager_temporary_pin",
        record_id=record.id,
        user_id=user.id,
        reason=f"PIN temporal de gerente generado (Expira en 5 minutos)"
    )

    db.commit()
    db.refresh(record)

    # Attach creator name
    setattr(record, "created_by_name", user.name)
    return record


@router.get("", response_model=list[ManagerTemporaryPinOut])
def list_temporary_pins(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    # Verify permission
    from app.services.supervisor_validation import SupervisorValidationService
    try:
        SupervisorValidationService(db, user.company_id).check_supervisor_permission(user, "attendance.edit_team")
    except HTTPException:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver el historial de PINs temporales")

    # Query temporary pins joined with ResUser to get the creator's name
    results = db.query(XManagerTemporaryPin, ResUser.name.label("created_by_name")).join(
        ResUser, ResUser.id == XManagerTemporaryPin.created_by_user_id, isouter=True
    ).filter(
        XManagerTemporaryPin.company_id == user.company_id
    ).order_by(XManagerTemporaryPin.created_at.desc()).limit(100).all()

    # Map tuples to records
    records = []
    for pin_record, created_by_name in results:
        setattr(pin_record, "created_by_name", created_by_name)
        records.append(pin_record)

    return records
