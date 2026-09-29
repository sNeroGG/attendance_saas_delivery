from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrEmployee, ResCompany, ResUser, XDevice, XFaceTemplate
from app.schemas.attendance import AttendanceEventOut, AttendanceEventTypeOut, KioskAttendanceEventCreate, KioskIdentifyPinRequest, KioskManagerOverrideRequest
from app.schemas.phase4 import FaceImageRequest
from app.security.auth import create_access_token, get_current_user, verify_secret
from app.security.kiosk_session import require_kiosk_employee
from app.security.rate_limit import check_rate_limit, clear_rate_limit
from app.services.attendance_logic import AttendanceLogicService
from app.services.schedules import describe_employee_work

router = APIRouter(prefix="/kiosk", tags=["kiosk"])


def pin_rate_key(device_code: str, request: Request) -> str:
    client_ip = request.client.host if request.client else "unknown"
    return f"pin:{device_code}:{client_ip}"


def get_device_by_code(db: Session, device_code: str) -> XDevice:
    device = db.query(XDevice).filter_by(device_code=device_code, active=True).first()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    return device


def is_device_lock_enabled(db: Session, device: XDevice) -> bool:
    if not getattr(device, "device_lock_enabled", True):
        return False
    company = db.get(ResCompany, device.company_id)
    if company is not None and not getattr(company, "device_lock_enabled", True):
        return False
    return True


def check_device_lock(db: Session, device: XDevice, employee_id: int) -> None:
    if not is_device_lock_enabled(db, device):
        return
    if device.locked_employee_id:
        if device.locked_employee_id != employee_id:
            locked_emp = db.get(HrEmployee, device.locked_employee_id)
            locked_name = locked_emp.name if locked_emp else "otro colaborador"
            raise HTTPException(
                status_code=403,
                detail=f"Este dispositivo móvil está registrado a nombre de: {locked_name}. Solo esa persona puede marcar asistencia aquí."
            )
    else:
        # Lock to the first employee who logs in
        device.locked_employee_id = employee_id
        db.commit()


def kiosk_employee_payload(db: Session, employee: HrEmployee, extra: dict | None = None) -> dict:
    work = describe_employee_work(db, employee.company_id, employee)
    payload = {
        "id": employee.id,
        "name": employee.name,
        "employee_code": employee.employee_code,
        "branch_id": employee.branch_id,
        "work_schedule": {
            "name": work["schedule_name"],
            "label": work["label"],
            "is_off": work["is_off"],
            "source": work["source"],
            "auto_checkout_label": work["auto_checkout_label"],
            "punch": work["punch"],
        },
    }
    if extra:
        payload.update(extra)
    return payload


@router.get("/{device_code}/config")
def kiosk_config(device_code: str, request: Request, db: Session = Depends(get_db)):
    device = get_device_by_code(db, device_code)
    device.last_seen_at = datetime.utcnow()
    device.last_ip = request.client.host if request.client else None
    db.commit()
    company = db.get(ResCompany, device.company_id)
    session_timeout = company.kiosk_session_timeout if company else device.session_timeout
    lock_enabled = is_device_lock_enabled(db, device)

    locked_employee_name = None
    locked_employee_id = device.locked_employee_id if lock_enabled else None
    if locked_employee_id:
        emp = db.get(HrEmployee, locked_employee_id)
        if emp:
            locked_employee_name = emp.name

    return {"device": {
        "id": device.id, 
        "name": device.name, 
        "device_code": device.device_code, 
        "branch_id": device.branch_id, 
        "company_id": device.company_id,
        "session_timeout": session_timeout,
        "device_lock_enabled": lock_enabled,
        "locked_employee_id": locked_employee_id,
        "locked_employee_name": locked_employee_name
    }}


@router.post("/identify-pin")
def identify_pin(payload: KioskIdentifyPinRequest, request: Request, db: Session = Depends(get_db)):
    device = get_device_by_code(db, payload.device_code)
    limit_key = pin_rate_key(payload.device_code, request)
    if not check_rate_limit(limit_key):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta de nuevo más tarde.")
    users = db.query(ResUser).filter_by(company_id=device.company_id, active=True).all()
    for user in users:
        if verify_secret(payload.pin, user.pin_hash):
            employee = db.get(HrEmployee, user.employee_id) if user.employee_id else None
            if not employee:
                employee = db.query(HrEmployee).filter_by(company_id=device.company_id, user_id=user.id, active=True).first()
            if not employee:
                raise HTTPException(status_code=404, detail="Usuario sin empleado vinculado")
            
            # Check device lock
            check_device_lock(db, device, employee.id)
            
            clear_rate_limit(limit_key)
            access_token = create_access_token(user)
            
            face_template = db.query(XFaceTemplate).filter_by(company_id=device.company_id, employee_id=employee.id, active=True).first()
            has_face_template = face_template is not None
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "employee": kiosk_employee_payload(db, employee, {"has_face_template": has_face_template}),
                "user": {"id": user.id, "name": user.name}
            }
    raise HTTPException(status_code=401, detail="PIN invalido")


@router.post("/identify-manager-override")
def identify_manager_override(payload: KioskManagerOverrideRequest, request: Request, db: Session = Depends(get_db)):
    device = get_device_by_code(db, payload.device_code)
    limit_key = pin_rate_key(payload.device_code, request)
    if not check_rate_limit(limit_key):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta de nuevo más tarde.")
    
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

    check_device_lock(db, device, employee.id)
    clear_rate_limit(limit_key)
    access_token = create_access_token(employee_user)
    face_template = db.query(XFaceTemplate).filter_by(company_id=device.company_id, employee_id=employee.id, active=True).first()
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "employee": kiosk_employee_payload(db, employee, {"has_face_template": face_template is not None}),
        "user": {"id": employee_user.id, "name": employee_user.name}
    }


@router.get("/employees/{employee_id}/available-events", response_model=list[AttendanceEventTypeOut])
def available_events(
    employee_id: int,
    device_code: str | None = None,
    db: Session = Depends(get_db),
    user: ResUser = Depends(get_current_user),
):
    require_kiosk_employee(db, user, employee_id)
    device = get_device_by_code(db, device_code) if device_code else None
    employee = db.get(HrEmployee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    company_id = device.company_id if device else employee.company_id
    if company_id != user.company_id:
        raise HTTPException(status_code=403, detail="Empleado de otra empresa")
    return AttendanceLogicService(db, company_id).get_available_event_types(employee_id, device.id if device else None)


@router.get("/employees/{employee_id}/work-status")
def kiosk_work_status(
    employee_id: int,
    db: Session = Depends(get_db),
    user: ResUser = Depends(get_current_user),
):
    require_kiosk_employee(db, user, employee_id)
    employee = db.get(HrEmployee, employee_id)
    if not employee or employee.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return describe_employee_work(db, user.company_id, employee)


@router.post("/verify-face")
def verify_kiosk_face(
    payload: FaceImageRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: ResUser = Depends(get_current_user),
):
    from app.routes.common import require_biometrics_enabled
    require_biometrics_enabled()
    from app.security.kiosk_session import session_employee_id
    from app.services.face_recognition import FaceRecognitionService
    employee_id = session_employee_id(db, user)
    if employee_id is None:
        raise HTTPException(status_code=403, detail="La sesion del kiosko no esta vinculada a un empleado")
    if not payload.image_base64:
        raise HTTPException(status_code=400, detail="Imagen requerida")
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(f"face-verify:{user.company_id}:{employee_id}:{client_ip}"):
        raise HTTPException(status_code=429, detail="Demasiadas verificaciones faciales. Intenta más tarde.")
    employee = db.get(HrEmployee, employee_id)
    if not employee or employee.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    success, confidence = FaceRecognitionService(db, user.company_id, user.id).compare_face(
        payload.image_base64,
        employee.id,
        payload.device_code,
        request.client.host if request.client else None,
    )
    return {
        "success": success,
        "confidence_score": confidence,
        "employee_id": employee.id,
        "employee_name": employee.name,
    }


@router.post("/attendance-events", response_model=AttendanceEventOut)
def create_kiosk_event(
    payload: KioskAttendanceEventCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: ResUser = Depends(get_current_user),
):
    require_kiosk_employee(db, user, payload.employee_id)
    device = get_device_by_code(db, payload.device_code)
    if device.company_id != user.company_id:
        raise HTTPException(status_code=403, detail="Dispositivo de otra empresa")
    check_device_lock(db, device, payload.employee_id)
    manager_override = False
    if payload.manager_pin:
        limit_key = pin_rate_key(payload.device_code, request)
        if not check_rate_limit(limit_key):
            raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta de nuevo más tarde.")
        from app.services.supervisor_validation import SupervisorValidationService
        try:
            manager = SupervisorValidationService(db, device.company_id).validate_supervisor_pin(payload.manager_pin)
            SupervisorValidationService(db, device.company_id).check_supervisor_permission(manager, "attendance.edit_team")
            manager_override = True
            clear_rate_limit(limit_key)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="PIN de Gerente invalido o sin permisos")
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
        manager_override=manager_override,
    )


@router.post("/unlock-device")
def unlock_device(payload: KioskIdentifyPinRequest, request: Request, db: Session = Depends(get_db)):
    device = get_device_by_code(db, payload.device_code)
    limit_key = pin_rate_key(payload.device_code, request)
    if not check_rate_limit(limit_key):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta de nuevo más tarde.")
    from app.services.supervisor_validation import SupervisorValidationService
    try:
        SupervisorValidationService(db, device.company_id).validate_supervisor_pin(payload.pin)
        device.locked_employee_id = None
        db.commit()
        clear_rate_limit(limit_key)
        return {"status": "ok", "message": "Dispositivo desbloqueado"}
    except Exception:
        raise HTTPException(status_code=401, detail="PIN de Gerente invalido o sin permisos")


@router.post("/verify-manager-pin")
def verify_manager_pin(payload: KioskIdentifyPinRequest, request: Request, db: Session = Depends(get_db)):
    device = get_device_by_code(db, payload.device_code)
    limit_key = pin_rate_key(payload.device_code, request)
    if not check_rate_limit(limit_key):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta de nuevo más tarde.")
    from app.services.supervisor_validation import SupervisorValidationService
    try:
        manager = SupervisorValidationService(db, device.company_id).validate_supervisor_pin(payload.pin)
        SupervisorValidationService(db, device.company_id).check_supervisor_permission(manager, "attendance.edit_team")
        clear_rate_limit(limit_key)
        return {"status": "ok", "message": "PIN de gerente verificado"}
    except Exception:
        raise HTTPException(status_code=401, detail="PIN de Gerente invalido o sin permisos")
