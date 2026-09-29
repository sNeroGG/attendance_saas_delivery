from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ResUser, XAuditLog, XAutoCheckoutRule, XBiometricLog, XFaceTemplate
from app.routes.common import apply_values, company_query, get_company_record, require_biometrics_enabled, require_company_admin, to_dict
from app.schemas.phase4 import (
    AuditLogOut,
    AutoCheckoutRuleIn,
    AutoCheckoutRuleOut,
    BiometricLogOut,
    DailyReportOut,
    FaceIdentifyOut,
    FaceImageRequest,
    FaceTemplateOut,
    ReportSummary,
    SupervisorFaceValidationRequest,
)
from app.security.auth import get_current_user
from app.security.rate_limit import check_rate_limit
from app.services.auto_checkout import AutoCheckoutService
from app.services.face_recognition import FaceRecognitionService
from app.services.reports import ReportService
from app.services.supervisor_validation import SupervisorValidationService

router = APIRouter(tags=["phase4"])


@router.post("/employees/{employee_id}/register-face")
def register_face(employee_id: int, payload: FaceImageRequest, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_biometrics_enabled()
    from app.security.kiosk_session import require_own_employee_or_admin
    require_own_employee_or_admin(db, user, employee_id)
    images = payload.images if payload.images else [payload.image_base64]
    FaceRecognitionService(db, user.company_id, user.id).register_face(employee_id, images)
    return {"ok": True}


@router.post("/employees/{employee_id}/disable-face")
def disable_face(employee_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_biometrics_enabled()
    require_company_admin(user)
    FaceRecognitionService(db, user.company_id, user.id).disable_face_template(employee_id)
    return {"ok": True}


@router.get("/employees/{employee_id}/face-templates", response_model=list[FaceTemplateOut])
def list_employee_face_templates(employee_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_biometrics_enabled()
    require_company_admin(user)
    return db.query(XFaceTemplate).filter_by(company_id=user.company_id, employee_id=employee_id).order_by(XFaceTemplate.id.desc()).all()


@router.post("/kiosk/identify-face", response_model=FaceIdentifyOut)
def identify_face(payload: FaceImageRequest, request: Request, db: Session = Depends(get_db)):
    require_biometrics_enabled()
    key = f"face:{payload.device_code or request.client.host if request.client else 'unknown'}"
    if not check_rate_limit(key):
        raise HTTPException(status_code=429, detail="Demasiadas verificaciones faciales. Intenta más tarde.")
    return FaceIdentifyOut(
        employee_id=None,
        employee_name=None,
        success=False,
        confidence_score=0,
        access_token=None,
        token_type=None,
        employee=None,
        user=None,
    )


@router.post("/kiosk/supervisor-face-validation")
def supervisor_face_validation(payload: SupervisorFaceValidationRequest, request: Request, db: Session = Depends(get_db)):
    require_biometrics_enabled()
    from app.routes.kiosk import get_device_by_code
    if not payload.device_code:
        return {"ok": False, "confidence_score": 0}
    device = get_device_by_code(db, payload.device_code)
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(f"face-supervisor:{device.id}:{client_ip}"):
        raise HTTPException(status_code=429, detail="Demasiadas verificaciones faciales. Intenta más tarde.")
    company_id = device.company_id
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
    require_company_admin(user)
    return company_query(db, XBiometricLog, user).order_by(XBiometricLog.timestamp.desc()).limit(300).all()


@router.get("/audit-logs", response_model=list[AuditLogOut])
def audit_logs(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    return company_query(db, XAuditLog, user).order_by(XAuditLog.timestamp.desc()).limit(300).all()


@router.get("/reports/daily", response_model=DailyReportOut)
def report_daily(employee_id: int | None = None, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    return ReportService(db, user.company_id).daily(employee_id)


@router.get("/reports/dashboard", response_model=DailyReportOut)
def report_dashboard(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    return ReportService(db, user.company_id).dashboard()


@router.get("/reports/hours", response_model=ReportSummary)
def report_hours(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    return ReportSummary(items=ReportService(db, user.company_id).hours())


@router.get("/reports/assignments", response_model=ReportSummary)
def report_assignments(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    return ReportSummary(items=ReportService(db, user.company_id).assignments())


@router.get("/reports/attendance-exceptions", response_model=ReportSummary)
def report_attendance_exceptions(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    return ReportSummary(items=ReportService(db, user.company_id).attendance_exceptions())


# (Reporte biométrico eliminado)


@router.get("/reports/calendar")
def report_calendar(start: date | None = None, end: date | None = None, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    from app.services.day_board import DayBoardService
    from app.services.operational_day import as_local
    today = as_local().date()
    start = start or (today - timedelta(days=today.weekday()))
    end = end or (start + timedelta(days=6))
    return DayBoardService(db, user.company_id).week(start, end)


@router.get("/reports/calendar/export")
def export_calendar(start: date | None = None, end: date | None = None, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    from app.services.day_board import DayBoardService, calendar_csv
    from app.services.operational_day import as_local
    today = as_local().date()
    start = start or date(today.year, today.month, 1)
    if end is None:
        if today.month == 12:
            end = date(today.year, 12, 31)
        else:
            end = date(today.year, today.month + 1, 1) - timedelta(days=1)
    if end < start:
        start, end = end, start
    rows = DayBoardService(db, user.company_id).export_rows(start, end)
    filename = f"asistencia-{start.isoformat()}-a-{end.isoformat()}.csv"
    return Response(
        content=calendar_csv(rows),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/calendar/export.pdf")
def export_calendar_pdf(start: date | None = None, end: date | None = None, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    from io import BytesIO
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from app.services.day_board import CSV_FIELDS, DayBoardService
    from app.services.operational_day import as_local

    today = as_local().date()
    start = start or date(today.year, today.month, 1)
    if end is None:
        end = date(today.year + (today.month == 12), today.month % 12 + 1, 1) - timedelta(days=1)
    if end < start:
        start, end = end, start
    rows = DayBoardService(db, user.company_id).export_rows(start, end)
    styles = getSampleStyleSheet()
    body = styles["BodyText"]
    body.fontSize = 7
    body.leading = 9
    headings = ["Fecha", "Empleado", "Código", "Puesto", "Estado", "Etiquetas", "Entrada", "Salida", "Tarde", "Permiso", "Día libre"]
    data = [headings]
    for row in rows:
        data.append([Paragraph(str(row.get(field, "") or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), body) for field in CSV_FIELDS])
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=landscape(letter), rightMargin=0.35*inch, leftMargin=0.35*inch, topMargin=0.4*inch, bottomMargin=0.4*inch)
    table = Table(data, repeatRows=1, colWidths=[0.65*inch, 1.05*inch, 0.5*inch, 0.65*inch, 0.7*inch, 1.05*inch, 0.75*inch, 0.75*inch, 0.38*inch, 0.48*inch, 0.55*inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f4f82")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d9e2ec")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f7fb")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    document.build([Paragraph(f"Calendario de asistencia: {start.isoformat()} a {end.isoformat()}", styles["Title"]), Spacer(1, 8), table])
    filename = f"asistencia-{start.isoformat()}-a-{end.isoformat()}.pdf"
    return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/reports/calendar/{day}")
def report_calendar_day(day: date, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    from app.services.day_board import DayBoardService
    return DayBoardService(db, user.company_id).day_detail(day)


@router.get("/reports/audit", response_model=ReportSummary)
def report_audit(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    return ReportSummary(items=ReportService(db, user.company_id).audit())


@router.get("/auto-checkout-rules", response_model=list[AutoCheckoutRuleOut])
def list_auto_checkout_rules(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    return company_query(db, XAutoCheckoutRule, user).order_by(XAutoCheckoutRule.id).all()


@router.post("/auto-checkout-rules", response_model=AutoCheckoutRuleOut)
def create_auto_checkout_rule(payload: AutoCheckoutRuleIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    record = XAutoCheckoutRule(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/auto-checkout-rules/{record_id}", response_model=AutoCheckoutRuleOut)
def update_auto_checkout_rule(record_id: int, payload: AutoCheckoutRuleIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    record = get_company_record(db, XAutoCheckoutRule, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record


@router.post("/jobs/process-auto-checkout")
def process_auto_checkout(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    closed = AutoCheckoutService(db, user.company_id, user.id).process_open_shifts()
    return {"closed_shift_ids": closed, "count": len(closed)}
