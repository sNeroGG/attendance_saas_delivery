from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrEmployee, ResUser, XNoAttendanceNote
from app.routes.common import company_query
from app.schemas.attendance import NoAttendanceNoteIn, NoAttendanceNoteOut
from app.security.auth import get_current_user
from app.services.audit_log import AuditLogService
from app.services.operational_day import EXCUSED_REASONS
from app.services.supervisor_validation import SupervisorValidationService

router = APIRouter(prefix="/no-attendance", tags=["no-attendance"])


@router.get("", response_model=list[NoAttendanceNoteOut])
def list_notes(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XNoAttendanceNote, user).order_by(XNoAttendanceNote.date.desc(), XNoAttendanceNote.id.desc()).all()


@router.post("", response_model=NoAttendanceNoteOut)
def create_note(payload: NoAttendanceNoteIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    reason = (payload.reason or "").lower()
    if reason in EXCUSED_REASONS:
        SupervisorValidationService(db, user.company_id).check_supervisor_permission(user, "attendance.excuse_absence")
        employee = db.get(HrEmployee, payload.employee_id)
        if not employee or employee.company_id != user.company_id:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")
        existing = (
            db.query(XNoAttendanceNote)
            .filter_by(company_id=user.company_id, employee_id=payload.employee_id, date=payload.date)
            .filter(XNoAttendanceNote.reason.in_(tuple(EXCUSED_REASONS)))
            .first()
        )
        values = payload.model_dump()
        values["reason"] = "permiso"
        values["state"] = values.get("state") if values.get("state") not in (None, "draft") else "approved"
        if existing:
            for key, value in values.items():
                setattr(existing, key, value)
            existing.write_uid = user.id
            record = existing
        else:
            record = XNoAttendanceNote(**values, company_id=user.company_id, create_uid=user.id, write_uid=user.id)
            db.add(record)
        db.flush()
        AuditLogService(db, user.company_id).record(
            "excuse_absence",
            "x_no_attendance_note",
            record.id,
            user_id=user.id,
            employee_id=payload.employee_id,
            reason=values.get("note") or "Permiso de faltar",
        )
        db.commit()
        db.refresh(record)
        return record
    record = XNoAttendanceNote(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
