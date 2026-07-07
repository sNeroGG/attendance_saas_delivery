from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser, XAuditLog, XAutoCheckoutRule
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.phase4 import (
    AuditLogOut,
    AutoCheckoutRuleIn,
    AutoCheckoutRuleOut,
    ReportSummary,
)
from app.security.auth import get_current_user
from app.services.auto_checkout import AutoCheckoutService
from app.services.reports import ReportService
from app.services.supervisor_validation import SupervisorValidationService

router = APIRouter(tags=["phase4"])


# (Endpoints de Face ID y Biometría eliminados para versión sin Face ID)


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
