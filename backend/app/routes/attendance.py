from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrAttendance, ResUser, XAttendanceEvent, XAttendanceEventType, XAttendanceShift
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.attendance import (
    AttendanceEventCreate,
    AttendanceEventOut,
    AttendanceEventTypeIn,
    AttendanceEventTypeOut,
    AttendanceEventUpdate,
    AttendanceShiftOut,
    HrAttendanceOut,
    ManualCheckoutRequest,
)
from app.security.auth import get_current_user
from app.services.attendance_logic import AttendanceLogicService

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("/event-types", response_model=list[AttendanceEventTypeOut])
def list_event_types(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XAttendanceEventType, user).order_by(XAttendanceEventType.sequence, XAttendanceEventType.id).all()


@router.post("/event-types", response_model=AttendanceEventTypeOut)
def create_event_type(payload: AttendanceEventTypeIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = XAttendanceEventType(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/event-types/{record_id}", response_model=AttendanceEventTypeOut)
def get_event_type(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, XAttendanceEventType, record_id, user)


@router.put("/event-types/{record_id}", response_model=AttendanceEventTypeOut)
def update_event_type(record_id: int, payload: AttendanceEventTypeIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XAttendanceEventType, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record


@router.get("/events", response_model=list[AttendanceEventOut])
def list_events(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    from app.models import HrEmployee, XAttendanceEventType
    query = (
        db.query(XAttendanceEvent)
        .filter(XAttendanceEvent.company_id == user.company_id)
        .order_by(XAttendanceEvent.timestamp.desc(), XAttendanceEvent.id.desc())
        .limit(300)
    )
    events = query.all()
    results = []
    for event in events:
        emp = db.get(HrEmployee, event.employee_id)
        emp_name = emp.name if emp else f"ID: {event.employee_id}"
        
        etype = db.get(XAttendanceEventType, event.event_type_id)
        etype_name = etype.name if etype else f"ID: {event.event_type_id}"
        
        d = {c.name: getattr(event, c.name) for c in event.__table__.columns}
        d["employee_name"] = emp_name
        d["event_type_name"] = etype_name
        results.append(d)
    return results


@router.post("/events", response_model=AttendanceEventOut)
def create_event(payload: AttendanceEventCreate, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    service = AttendanceLogicService(db, user.company_id, user.id)
    return service.create_attendance_event(**payload.model_dump())


@router.put("/events/{record_id}", response_model=AttendanceEventOut)
def update_event(record_id: int, payload: AttendanceEventUpdate, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XAttendanceEvent, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.flush()
    if record.shift_id:
        service = AttendanceLogicService(db, user.company_id, user.id)
        service.recalculate_shift(record.shift_id)
        service.sync_shift_to_hr_attendance(record.shift_id)
    db.commit()
    db.refresh(record)
    return record


@router.post("/events/{record_id}/cancel", response_model=AttendanceEventOut)
def cancel_event(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return AttendanceLogicService(db, user.company_id, user.id).cancel_event(record_id)


@router.get("/shifts", response_model=list[AttendanceShiftOut])
def list_shifts(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XAttendanceShift, user).order_by(XAttendanceShift.check_in_at.desc()).limit(300).all()


@router.post("/shifts/{record_id}/manual-checkout", response_model=AttendanceShiftOut)
def manual_checkout(record_id: int, payload: ManualCheckoutRequest, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return AttendanceLogicService(db, user.company_id, user.id).manual_checkout(record_id, payload.timestamp, payload.note)


@router.get("/hr-attendance", response_model=list[HrAttendanceOut])
def list_hr_attendance(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, HrAttendance, user).order_by(HrAttendance.check_in.desc()).limit(300).all()
