from sqlalchemy.orm import Session
from app.models import XBiometricLog


class BiometricLogService:
    def __init__(self, db: Session, company_id: int):
        self.db = db
        self.company_id = company_id

    def record(self, event_type: str, method: str, success: bool, employee_id: int | None = None, device_id: int | None = None, confidence_score: float | None = None, failure_reason: str | None = None, ip_address: str | None = None) -> XBiometricLog:
        log = XBiometricLog(company_id=self.company_id, employee_id=employee_id, device_id=device_id, event_type=event_type, method=method, success=success, confidence_score=confidence_score, failure_reason=failure_reason, ip_address=ip_address)
        self.db.add(log)
        self.db.flush()
        return log
