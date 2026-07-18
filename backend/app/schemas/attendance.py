from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DeviceIn(BaseModel):
    branch_id: int | None = None
    name: str
    device_code: str
    device_type: str = "kiosk"
    last_ip: str | None = None
    active: bool = True
    session_timeout: int = 30
    device_lock_enabled: bool = True
    locked_employee_id: int | None = None


class DeviceOut(DeviceIn, ORMModel):
    id: int
    company_id: int
    last_seen_at: datetime | None = None


class AttendanceEventTypeIn(BaseModel):
    name: str
    code: str
    direction: str
    opens_shift: bool = False
    closes_shift: bool = False
    counts_as_worked_time: bool = True
    counts_as_break: bool = False
    counts_as_meal: bool = False
    counts_as_non_worked: bool = False
    allows_assignments_after: bool = False
    blocks_assignments_after: bool = False
    requires_supervisor_validation: bool = False
    requires_note: bool = False
    requires_evidence: bool = False
    sequence: int = 10
    active: bool = True


class AttendanceEventTypeOut(AttendanceEventTypeIn, ORMModel):
    id: int
    company_id: int


class AttendanceEventCreate(BaseModel):
    employee_id: int
    event_type_id: int
    method: str = "manual"
    device_id: int | None = None
    timestamp: datetime | None = None
    note: str | None = None
    evidence_url: str | None = None
    source: str = "admin"


class KioskIdentifyPinRequest(BaseModel):
    device_code: str
    pin: str


class KioskManagerOverrideRequest(BaseModel):
    device_code: str
    employee_pin: str
    manager_pin: str


class KioskAttendanceEventCreate(BaseModel):
    employee_id: int
    event_type_id: int
    device_code: str
    note: str | None = None
    evidence_url: str | None = None
    method: str | None = None


class AttendanceEventOut(ORMModel):
    id: int
    company_id: int
    employee_id: int
    employee_name: str | None = None
    branch_id: int | None
    device_id: int | None
    event_type_id: int
    event_type_name: str | None = None
    shift_id: int | None
    timestamp: datetime
    method: str
    supervisor_id: int | None
    confidence_score: float | None
    note: str | None
    evidence_url: str | None
    source: str
    state: str


class AttendanceEventUpdate(BaseModel):
    timestamp: datetime | None = None
    note: str | None = None
    evidence_url: str | None = None
    state: str | None = None


class AttendanceShiftOut(ORMModel):
    id: int
    company_id: int
    employee_id: int
    branch_id: int | None
    check_in_at: datetime
    check_out_at: datetime | None
    total_time_minutes: int
    worked_time_minutes: int
    break_time_minutes: int
    meal_time_minutes: int
    non_worked_time_minutes: int
    auto_closed: bool
    state: str
    note: str | None


class HrAttendanceOut(ORMModel):
    id: int
    company_id: int
    employee_id: int
    check_in: datetime
    check_out: datetime | None
    worked_hours: float
    x_shift_id: int | None
    x_source: str | None
    x_external_reference: str | None


class NoAttendanceNoteIn(BaseModel):
    employee_id: int
    date: date
    reason: str
    note: str | None = None
    evidence_url: str | None = None
    state: str = "draft"


class NoAttendanceNoteOut(NoAttendanceNoteIn, ORMModel):
    id: int
    company_id: int


class ManualCheckoutRequest(BaseModel):
    timestamp: datetime | None = None
    note: str | None = None
