from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AuditMixin:
    create_uid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    write_uid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    create_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    write_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class ActiveMixin:
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CompanyScopedMixin:
    company_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)


class ResCompany(Base, AuditMixin, ActiveMixin):
    __tablename__ = "res_company"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(220))
    vat: Mapped[str | None] = mapped_column(String(64))
    email: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(64))
    website: Mapped[str | None] = mapped_column(String(180))
    street: Mapped[str | None] = mapped_column(String(220))
    city: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str | None] = mapped_column(String(120))
    timezone: Mapped[str] = mapped_column(String(80), default="America/El_Salvador", nullable=False)
    plan: Mapped[str] = mapped_column(String(80), default="starter", nullable=False)
    state: Mapped[str] = mapped_column(String(40), default="active", nullable=False)


class XBranch(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "x_branch"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    code: Mapped[str | None] = mapped_column(String(64), index=True)
    street: Mapped[str | None] = mapped_column(String(220))
    city: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str | None] = mapped_column(String(120))
    timezone: Mapped[str] = mapped_column(String(80), default="America/El_Salvador", nullable=False)


class ResUser(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "res_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    login: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(160), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    pin_hash: Mapped[str | None] = mapped_column(String(255))
    pin_plain: Mapped[str | None] = mapped_column(String(40))
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_company_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime)


class HrDepartment(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "hr_department"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    manager_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class HrJob(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "hr_job"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class XEmployeeStatus(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "x_employee_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    allows_check_in: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allows_assignments: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    requires_note: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_terminated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_incapacitated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_rehire: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class HrEmployee(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "hr_employee"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(120))
    last_name: Mapped[str | None] = mapped_column(String(120))
    employee_code: Mapped[str | None] = mapped_column(String(80), index=True)
    work_email: Mapped[str | None] = mapped_column(String(160))
    work_phone: Mapped[str | None] = mapped_column(String(64))
    mobile_phone: Mapped[str | None] = mapped_column(String(64))
    department_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    job_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    job_title: Mapped[str | None] = mapped_column(String(160))
    employee_type: Mapped[str] = mapped_column(String(40), default="fixed", nullable=False)
    employment_status_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    hire_date: Mapped[date | None] = mapped_column(Date)
    termination_date: Mapped[date | None] = mapped_column(Date)
    rehire_date: Mapped[date | None] = mapped_column(Date)
    is_active_for_work: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class XEmployeeStatusHistory(Base, CompanyScopedMixin, AuditMixin):
    __tablename__ = "x_employee_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    old_status_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    new_status_id: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    changed_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class XRole(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "x_role"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class XPermission(Base, AuditMixin, ActiveMixin):
    __tablename__ = "x_permission"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class XRolePermission(Base):
    __tablename__ = "x_role_permission"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    permission_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    create_uid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    create_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class XEmployeeRole(Base):
    __tablename__ = "x_employee_role"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    role_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    create_uid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    create_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

class XDevice(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "x_device"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    device_code: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    device_type: Mapped[str] = mapped_column(String(40), default="kiosk", nullable=False)
    last_ip: Mapped[str | None] = mapped_column(String(80))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime)
    session_timeout: Mapped[int] = mapped_column(Integer, default=30, nullable=False, server_default="30")


class XAttendanceEventType(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "x_attendance_event_type"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    code: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    opens_shift: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    closes_shift: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    counts_as_worked_time: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    counts_as_break: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    counts_as_meal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    counts_as_non_worked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allows_assignments_after: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    blocks_assignments_after: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_supervisor_validation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_face_id: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allows_pin: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    requires_note: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_evidence: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, default=10, nullable=False)


class XAttendanceShift(Base, CompanyScopedMixin, AuditMixin):
    __tablename__ = "x_attendance_shift"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    branch_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    check_in_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    check_out_at: Mapped[datetime | None] = mapped_column(DateTime)
    total_time_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    worked_time_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    break_time_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    meal_time_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    non_worked_time_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    auto_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    state: Mapped[str] = mapped_column(String(40), default="open", nullable=False)
    note: Mapped[str | None] = mapped_column(Text)


class XAttendanceEvent(Base, CompanyScopedMixin, AuditMixin):
    __tablename__ = "x_attendance_event"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    branch_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    device_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    event_type_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    shift_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    method: Mapped[str] = mapped_column(String(40), default="pin", nullable=False)
    supervisor_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(40), default="kiosk", nullable=False)
    state: Mapped[str] = mapped_column(String(40), default="done", nullable=False)


class HrAttendance(Base, CompanyScopedMixin, AuditMixin):
    __tablename__ = "hr_attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    check_in: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    check_out: Mapped[datetime | None] = mapped_column(DateTime)
    worked_hours: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    x_shift_id: Mapped[int | None] = mapped_column(Integer, nullable=True, unique=True, index=True)
    x_source: Mapped[str | None] = mapped_column(String(80))
    x_external_reference: Mapped[str | None] = mapped_column(String(160))


class XNoAttendanceNote(Base, CompanyScopedMixin, AuditMixin):
    __tablename__ = "x_no_attendance_note"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(String(160), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(String(500))
    state: Mapped[str] = mapped_column(String(40), default="draft", nullable=False)

class XAssignmentTemplate(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "x_assignment_template"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(40), default="draft", nullable=False)


class XAssignmentQuestion(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "x_assignment_question"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(40), default="short_text", nullable=False)
    options_json: Mapped[str | None] = mapped_column(Text)
    required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    requires_evidence: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_supervisor_validation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, default=10, nullable=False)


class XEmployeeAssignment(Base, CompanyScopedMixin, AuditMixin):
    __tablename__ = "x_employee_assignment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    shift_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    template_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    due_at: Mapped[datetime | None] = mapped_column(DateTime)
    required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    blocks_check_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    blocks_check_out: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    state: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)
    applied_rule_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)


class XAssignmentAnswer(Base, CompanyScopedMixin, AuditMixin):
    __tablename__ = "x_assignment_answer"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_assignment_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    question_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    answer_text: Mapped[str | None] = mapped_column(Text)
    answer_number: Mapped[float | None] = mapped_column(Float)
    answer_boolean: Mapped[bool | None] = mapped_column(Boolean)
    answer_json: Mapped[str | None] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(String(500))
    answered_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime)
    state: Mapped[str] = mapped_column(String(40), default="done", nullable=False)


class XAssignmentValidation(Base, CompanyScopedMixin, AuditMixin):
    __tablename__ = "x_assignment_validation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_assignment_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    supervisor_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    method: Mapped[str] = mapped_column(String(40), default="supervisor_pin", nullable=False)
    result: Mapped[str] = mapped_column(String(40), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    validated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class XRule(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "x_rule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    employee_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    role_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    branch_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    event_type_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    assignment_template_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    frequency_type: Mapped[str] = mapped_column(String(40), default="per_shift", nullable=False)
    frequency_value: Mapped[str | None] = mapped_column(String(120))
    required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    blocks_check_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    blocks_check_out: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_supervisor_validation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_note: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_evidence: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)




class XAuditLog(Base, CompanyScopedMixin):
    __tablename__ = "x_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    employee_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    record_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    field_name: Mapped[str | None] = mapped_column(String(120))
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(Text)
    device_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    create_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class XAutoCheckoutRule(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "x_auto_checkout_rule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    role_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    employee_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    auto_checkout_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    checkout_time: Mapped[str] = mapped_column(String(10), default="18:00", nullable=False)
    timezone: Mapped[str] = mapped_column(String(80), default="America/El_Salvador", nullable=False)
    note: Mapped[str | None] = mapped_column(Text)


class XManagerTemporaryPin(Base, CompanyScopedMixin):
    __tablename__ = "x_manager_temporary_pin"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pin: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    created_by_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class XFaceTemplate(Base, CompanyScopedMixin, AuditMixin, ActiveMixin):
    __tablename__ = "x_face_template"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    face_encoding: Mapped[str] = mapped_column(Text, nullable=False)
    face_feature: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str] = mapped_column(String(40), default="opencv", nullable=False)
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.40, nullable=False)


class XBiometricLog(Base, CompanyScopedMixin):
    __tablename__ = "x_biometric_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    device_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    method: Mapped[str] = mapped_column(String(40), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Float)
    failure_reason: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(80))
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


