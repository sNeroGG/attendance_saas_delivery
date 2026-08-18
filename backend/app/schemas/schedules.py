from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class WorkScheduleLineIn(BaseModel):
    weekday: int
    start_time: str = "11:00"
    end_time: str = "03:00"
    is_off: bool = False
    overnight: bool = True


class WorkScheduleLineOut(WorkScheduleLineIn, ORMModel):
    id: int | None = None
    schedule_id: int | None = None


class WorkScheduleIn(BaseModel):
    name: str
    description: str | None = None
    timezone: str = "America/El_Salvador"
    active: bool = True
    is_default: bool = False
    lines: list[WorkScheduleLineIn] = Field(default_factory=list)


class WorkScheduleOut(ORMModel):
    id: int
    company_id: int
    name: str
    description: str | None = None
    timezone: str
    active: bool
    is_default: bool
    lines: list[WorkScheduleLineOut] = Field(default_factory=list)


class ScheduleAssignmentIn(BaseModel):
    schedule_id: int | None = None


class RoleScheduleOut(BaseModel):
    id: int
    name: str
    schedule_id: int | None = None
    schedule_name: str | None = None


class EmployeeScheduleOut(BaseModel):
    id: int
    name: str
    employee_code: str | None = None
    job_title: str | None = None
    role_name: str | None = None
    schedule_id: int | None = None
    resolved_schedule_id: int | None = None
    resolved_schedule_name: str | None = None
    source: str


class WorkScheduleOverviewOut(BaseModel):
    default_schedule_id: int | None = None
    schedules: list[WorkScheduleOut]
    roles: list[RoleScheduleOut]
    employees: list[EmployeeScheduleOut]
