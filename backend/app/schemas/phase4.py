from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# (Esquemas de Face ID y logs biométricos eliminados)


class AuditLogOut(ORMModel):
    id: int
    company_id: int
    user_id: int | None
    employee_id: int | None
    action: str
    model_name: str
    record_id: int | None
    field_name: str | None
    old_value: str | None
    new_value: str | None
    reason: str | None
    device_id: int | None
    ip_address: str | None
    timestamp: datetime


class AutoCheckoutRuleIn(BaseModel):
    branch_id: int | None = None
    role_id: int | None = None
    employee_id: int | None = None
    auto_checkout_enabled: bool = True
    checkout_time: str = "18:00"
    timezone: str = "America/El_Salvador"
    note: str | None = None
    active: bool = True


class AutoCheckoutRuleOut(AutoCheckoutRuleIn, ORMModel):
    id: int
    company_id: int


class ReportSummary(BaseModel):
    items: list[dict]
