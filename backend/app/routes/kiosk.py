from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrEmployee, ResUser, XDevice, XFaceTemplate
from app.schemas.attendance import AttendanceEventOut, AttendanceEventTypeOut, KioskAttendanceEventCreate, KioskIdentifyPinRequest, KioskManagerOverrideRequest
from app.security.auth import create_access_token, verify_secret
from app.security.rate_limit import check_rate_limit, clear_rate_limit
from app.services.attendance_logic import AttendanceLogicService

router = APIRouter(prefix="/kiosk", tags=["kiosk"])


def get_device_by_code(db: Session, device_code: str) -> XDevice:
    device = db.query(XDevice).filter_by(device_code=device_code, active=True).first()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    return device


@router.get("/{device_code}/config")
def kiosk_config(device_code: str, request: Request, db: Session = Depends(get_db)):
    device = get_device_by_code(db, device_code)
    device.last_seen_at = datetime.utcnow()
    device.last_ip = request.client.host if request.client else None
    db.commit()
    return {"device": {
        "id": device.id, 
        "name": device.name, 
        "device_code": device.device_code, 
        "branch_id": device.branch_id, 
        "company_id": device.company_id,
        "session_timeout": device.session_timeout
    }}


@router.post("/identify-pin")
def identify_pin(payload: KioskIdentifyPinRequest, db: Session = Depends(get_db)):
    check_rate_limit(f"pin:{payload.device_code}")
    device = get_device_by_code(db, payload.device_code)
    users = db.query(ResUser).filter_by(company_id=device.company_id, active=True).all()
    for user in users:
        if verify_secret(payload.pin, user.pin_hash):
            employee = db.get(HrEmployee, user.employee_id) if user.employee_id else None
            if not employee:
                employee = db.query(HrEmployee).filter_by(company_id=device.company_id, user_id=user.id, active=True).first()
            if not employee:
                raise HTTPException(status_code=404, detail="Usuario sin empleado vinculado")
            clear_rate_limit(f"pin:{payload.device_code}")
            access_token = create_access_token(user)
            
            face_template = db.query(XFaceTemplate).filter_by(company_id=device.company_id, employee_id=employee.id, active=True).first()
            has_face_template = face_template is not None
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "employee": {
                    "id": employee.id, 
                    "name": employee.name, 
                    "employee_code": employee.employee_code, 
                    "branch_id": employee.branch_id,
                    "has_face_template": has_face_template
                },
                "user": {"id": user.id, "name": user.name}
            }
    raise HTTPException(status_code=401, detail="PIN invalido")


@router.post("/identify-manager-override")
def identify_manager_override(payload: KioskManagerOverrideRequest, db: Session = Depends(get_db)):
    check_rate_limit(f"pin:{payload.device_code}")
    device = get_device_by_code(db, payload.device_code)
    
    # 1. Validate Manager PIN
    from app.services.supervisor_validation import SupervisorValidationService
    try:
        manager = SupervisorValidationService(db, device.company_id).validate_supervisor_pin(payload.manager_pin)
        # Check if they have supervisor permission
        SupervisorValidationService(db, device.company_id).check_supervisor_permission(manager, "attendance.edit_team")
    except Exception:
        raise HTTPException(status_code=401, detail="PIN de Gerente invalido o sin permisos")

    # 2. Validate Employee PIN
    employee = None
    employee_user = None
    users = db.query(ResUser).filter_by(company_id=device.company_id, active=True).all()
    for u in users:
        if verify_secret(payload.employee_pin, u.pin_hash):
            employee = db.get(HrEmployee, u.employee_id) if u.employee_id else None
            if not employee:
                employee = db.query(HrEmployee).filter_by(company_id=device.company_id, user_id=u.id, active=True).first()
            if employee:
                employee_user = u
                break

    if not employee or not employee_user:
        raise HTTPException(status_code=404, detail="PIN de empleado invalido")

    clear_rate_limit(f"pin:{payload.device_code}")
    access_token = create_access_token(employee_user)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "employee": {
            "id": employee.id,
            "name": employee.name,
            "employee_code": employee.employee_code,
            "branch_id": employee.branch_id,
            "has_face_template": True  # Bypasses registration screen since it's an override
        },
        "user": {"id": employee_user.id, "name": employee_user.name}
    }


@router.get("/employees/{employee_id}/available-events", response_model=list[AttendanceEventTypeOut])
def available_events(employee_id: int, device_code: str | None = None, db: Session = Depends(get_db)):
    device = get_device_by_code(db, device_code) if device_code else None
    employee = db.get(HrEmployee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    company_id = device.company_id if device else employee.company_id
    return AttendanceLogicService(db, company_id).get_available_event_types(employee_id, device.id if device else None)


@router.post("/attendance-events", response_model=AttendanceEventOut)
def create_kiosk_event(payload: KioskAttendanceEventCreate, db: Session = Depends(get_db)):
    device = get_device_by_code(db, payload.device_code)
    service = AttendanceLogicService(db, device.company_id)
    return service.create_attendance_event(
        employee_id=payload.employee_id,
        event_type_id=payload.event_type_id,
        method=payload.method or "pin",
        device_id=device.id,
        timestamp=datetime.utcnow(),
        note=payload.note,
        evidence_url=payload.evidence_url,
        source="kiosk",
    )


@router.post("/unlock-device")
def unlock_device(payload: KioskIdentifyPinRequest, db: Session = Depends(get_db)):
    device = get_device_by_code(db, payload.device_code)
    from app.services.supervisor_validation import SupervisorValidationService
    try:
        SupervisorValidationService(db, device.company_id).validate_supervisor_pin(payload.pin)
        return {"status": "ok", "message": "Dispositivo desbloqueado"}
    except Exception:
        raise HTTPException(status_code=401, detail="PIN de Gerente invalido o sin permisos")
