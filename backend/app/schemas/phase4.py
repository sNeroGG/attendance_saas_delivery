from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class FaceImageRequest(BaseModel):
    image_base64: str | None = None
    images: list[str] | None = None
    device_code: str | None = None


class SupervisorFaceValidationRequest(BaseModel):
    image_base64: str
    permission_code: str = "attendance.edit_team"
    device_code: str | None = None


class FaceTemplateOut(ORMModel):
    id: int
    company_id: int
    employee_id: int
    provider: str
    confidence_threshold: float
    active: bool


class FaceIdentifyOut(BaseModel):
    employee_id: int | None
    employee_name: str | None = None
    success: bool
    confidence_score: float
    provider: str = "opencv"
    access_token: str | None = None
    token_type: str | None = None
    employee: dict | None = None
    user: dict | None = None


class BiometricLogOut(ORMModel):
    id: int
    company_id: int
    employee_id: int | None
    device_id: int | None
    event_type: str
    method: str
    success: bool
    confidence_score: float | None
    failure_reason: str | None
    ip_address: str | None
    timestamp: datetime


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


class DailyReportOut(BaseModel):
    operational_day: dict
    summary: dict
    employees: list[dict]
    active_now: list[dict] | None = None
    pending_validation: int | None = None


class LedgerOut(BaseModel):
    employee: dict | None
    entries: list[dict]
