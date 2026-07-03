from sqlalchemy.orm import Session
from app.models import XAuditLog


class AuditLogService:
    def __init__(self, db: Session, company_id: int):
        self.db = db
        self.company_id = company_id

    def record(self, action: str, model_name: str, record_id: int | None = None, user_id: int | None = None, employee_id: int | None = None, field_name: str | None = None, old_value: str | None = None, new_value: str | None = None, reason: str | None = None, device_id: int | None = None, ip_address: str | None = None) -> XAuditLog:
        log = XAuditLog(company_id=self.company_id, action=action, model_name=model_name, record_id=record_id, user_id=user_id, employee_id=employee_id, field_name=field_name, old_value=old_value, new_value=new_value, reason=reason, device_id=device_id, ip_address=ip_address)
        self.db.add(log)
        self.db.flush()
        return log
