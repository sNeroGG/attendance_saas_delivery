from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    login: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class CompanyBase(BaseModel):
    name: str | None = None
    legal_name: str | None = None
    vat: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    street: str | None = None
    city: str | None = None
    country: str | None = None
    timezone: str | None = "America/El_Salvador"
    plan: str | None = "starter"
    state: str | None = "active"
    active: bool | None = True
    kiosk_session_timeout: int | None = 30


class CompanyOut(CompanyBase, ORMModel):
    id: int
    create_date: datetime
    write_date: datetime


class BranchIn(BaseModel):
    name: str
    code: str | None = None
    street: str | None = None
    city: str | None = None
    country: str | None = None
    timezone: str = "America/El_Salvador"
    active: bool = True


class BranchOut(BranchIn, ORMModel):
    id: int
    company_id: int


class UserCreate(BaseModel):
    name: str
    login: str
    email: str | None = None
    password: str | None = Field(default=None, min_length=6)
    pin: str | None = Field(default=None, min_length=4, max_length=12)
    employee_id: int | None = None
    is_superadmin: bool = False
    is_company_admin: bool = False
    active: bool = True


class UserUpdate(BaseModel):
    name: str | None = None
    login: str | None = None
    email: str | None = None
    password: str | None = Field(default=None, min_length=6)
    pin: str | None = Field(default=None, min_length=4, max_length=12)
    employee_id: int | None = None
    is_superadmin: bool | None = None
    is_company_admin: bool | None = None
    active: bool | None = None


class UserOut(ORMModel):
    id: int
    company_id: int
    employee_id: int | None
    name: str
    login: str
    email: str | None
    pin_plain: str | None = None
    is_superadmin: bool
    is_company_admin: bool
    active: bool
    last_login: datetime | None


class DepartmentIn(BaseModel):
    name: str
    manager_id: int | None = None
    active: bool = True


class DepartmentOut(DepartmentIn, ORMModel):
    id: int
    company_id: int


class JobIn(BaseModel):
    name: str
    description: str | None = None
    active: bool = True


class JobOut(JobIn, ORMModel):
    id: int
    company_id: int


class EmployeeStatusIn(BaseModel):
    name: str
    code: str
    allows_check_in: bool = True
    allows_assignments: bool = True
    requires_note: bool = False
    is_terminated: bool = False
    is_suspended: bool = False
    is_incapacitated: bool = False
    is_rehire: bool = False
    active: bool = True


class EmployeeStatusOut(EmployeeStatusIn, ORMModel):
    id: int
    company_id: int


class EmployeeIn(BaseModel):
    branch_id: int | None = None
    user_id: int | None = None
    name: str
    first_name: str | None = None
    last_name: str | None = None
    employee_code: str | None = None
    work_email: str | None = None
    work_phone: str | None = None
    mobile_phone: str | None = None
    department_id: int | None = None
    job_id: int | None = None
    job_title: str | None = None
    employee_type: str = "fixed"
    employment_status_id: int | None = None
    hire_date: date | None = None
    termination_date: date | None = None
    rehire_date: date | None = None
    is_active_for_work: bool = True
    notes: str | None = None
    active: bool = True
    create_user_profile: bool | None = True
    user_login: str | None = None
    user_pin: str | None = None
    task_template_ids: list[int] = Field(default_factory=list)


class EmployeeOut(EmployeeIn, ORMModel):
    id: int
    company_id: int
    face_image: str | None = None


class ChangeStatusRequest(BaseModel):
    new_status_id: int
    reason: str | None = None


class RoleIn(BaseModel):
    name: str
    description: str | None = None
    active: bool = True


class RoleOut(RoleIn, ORMModel):
    id: int
    company_id: int


class PermissionOut(ORMModel):
    id: int
    code: str
    name: str
    category: str
    description: str | None
    active: bool


class AssignPermissionRequest(BaseModel):
    permission_ids: list[int]


class AssignRoleRequest(BaseModel):
    role_id: int


class ManagerTemporaryPinOut(ORMModel):
    id: int
    company_id: int
    pin: str
    created_by_user_id: int
    created_at: datetime
    expires_at: datetime
    used_at: datetime | None
    created_by_name: str | None = None

