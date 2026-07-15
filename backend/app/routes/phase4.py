from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ResUser, XAuditLog, XAutoCheckoutRule, XBiometricLog, XFaceTemplate
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.phase4 import (
    AuditLogOut,
    AutoCheckoutRuleIn,
    AutoCheckoutRuleOut,
    BiometricLogOut,
    FaceIdentifyOut,
    FaceImageRequest,
    FaceTemplateOut,
    ReportSummary,
    SupervisorFaceValidationRequest,
)
from app.security.auth import get_current_user
from app.security.rate_limit import check_rate_limit, clear_rate_limit
from app.services.auto_checkout import AutoCheckoutService
from app.services.face_recognition import FaceRecognitionService
from app.services.reports import ReportService
from app.services.supervisor_validation import SupervisorValidationService

router = APIRouter(tags=["phase4"])


@router.post("/employees/{employee_id}/register-face")
def register_face(employee_id: int, payload: FaceImageRequest, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    images = payload.images if payload.images else [payload.image_base64]
    FaceRecognitionService(db, user.company_id, user.id).register_face(employee_id, images)
    return {"ok": True}


@router.post("/employees/{employee_id}/disable-face")
def disable_face(employee_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    FaceRecognitionService(db, user.company_id, user.id).disable_face_template(employee_id)
    return {"ok": True}


@router.get("/employees/{employee_id}/face-templates", response_model=list[FaceTemplateOut])
def list_employee_face_templates(employee_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return db.query(XFaceTemplate).filter_by(company_id=user.company_id, employee_id=employee_id).order_by(XFaceTemplate.id.desc()).all()


@router.post("/kiosk/identify-face", response_model=FaceIdentifyOut)
def identify_face(payload: FaceImageRequest, request: Request, db: Session = Depends(get_db)):
    key = f"face:{payload.device_code or request.client.host if request.client else 'unknown'}"
    check_rate_limit(key)
    from app.models import XDevice
    device = db.query(XDevice).filter_by(device_code=payload.device_code).first() if payload.device_code else None
    company_id = device.company_id if device else 2
    employee, confidence = FaceRecognitionService(db, company_id).identify_face(payload.image_base64, payload.device_code, request.client.host if request.client else None)
    
    access_token = None
    token_type = None
    employee_data = None
    user_data = None
    
    if employee:
        clear_rate_limit(key)
        user = db.query(ResUser).filter_by(company_id=company_id, employee_id=employee.id, active=True).first()
        if user:
            from app.security.auth import create_access_token
            access_token = create_access_token(user)
            token_type = "bearer"
            employee_data = {
                "id": employee.id,
                "name": employee.name,
                "employee_code": employee.employee_code,
                "branch_id": employee.branch_id
            }
            user_data = {
                "id": user.id,
                "name": user.name
            }
            
    return FaceIdentifyOut(
        employee_id=employee.id if employee else None,
        employee_name=employee.name if employee else None,
        success=employee is not None,
        confidence_score=confidence,
        access_token=access_token,
        token_type=token_type,
        employee=employee_data,
        user=user_data
    )


@router.post("/kiosk/supervisor-face-validation")
def supervisor_face_validation(payload: SupervisorFaceValidationRequest, request: Request, db: Session = Depends(get_db)):
    from app.models import XDevice
    device = db.query(XDevice).filter_by(device_code=payload.device_code).first() if payload.device_code else None
    company_id = device.company_id if device else 2
    employee, confidence = FaceRecognitionService(db, company_id).identify_face(payload.image_base64, payload.device_code, request.client.host if request.client else None)
    if not employee:
        return {"ok": False, "confidence_score": confidence}
    user = db.query(ResUser).filter_by(company_id=company_id, employee_id=employee.id, active=True).first()
    if not user:
        return {"ok": False, "confidence_score": confidence}
    SupervisorValidationService(db, company_id).check_supervisor_permission(user, payload.permission_code)
    return {"ok": True, "employee_id": employee.id, "confidence_score": confidence}


@router.get("/biometric-logs", response_model=list[BiometricLogOut])
def biometric_logs(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XBiometricLog, user).order_by(XBiometricLog.timestamp.desc()).limit(300).all()


@router.get("/audit-logs", response_model=list[AuditLogOut])
def audit_logs(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XAuditLog, user).order_by(XAuditLog.timestamp.desc()).limit(300).all()


@router.get("/reports/hours", response_model=ReportSummary)
def report_hours(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return ReportSummary(items=ReportService(db, user.company_id).hours())


@router.get("/reports/assignments", response_model=ReportSummary)
def report_assignments(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return ReportSummary(items=ReportService(db, user.company_id).assignments())


@router.get("/reports/attendance-exceptions", response_model=ReportSummary)
def report_attendance_exceptions(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return ReportSummary(items=ReportService(db, user.company_id).attendance_exceptions())


# (Reporte biométrico eliminado)


@router.get("/reports/audit", response_model=ReportSummary)
def report_audit(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return ReportSummary(items=ReportService(db, user.company_id).audit())


@router.get("/auto-checkout-rules", response_model=list[AutoCheckoutRuleOut])
def list_auto_checkout_rules(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XAutoCheckoutRule, user).order_by(XAutoCheckoutRule.id).all()


@router.post("/auto-checkout-rules", response_model=AutoCheckoutRuleOut)
def create_auto_checkout_rule(payload: AutoCheckoutRuleIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = XAutoCheckoutRule(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/auto-checkout-rules/{record_id}", response_model=AutoCheckoutRuleOut)
def update_auto_checkout_rule(record_id: int, payload: AutoCheckoutRuleIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XAutoCheckoutRule, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record


@router.post("/jobs/process-auto-checkout")
def process_auto_checkout(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    closed = AutoCheckoutService(db, user.company_id, user.id).process_open_shifts()
    return {"closed_shift_ids": closed, "count": len(closed)}
