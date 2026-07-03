"""phase 1 core saas

Revision ID: 0001_phase1_core
Revises:
Create Date: 2026-06-26
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0001_phase1_core"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def audit_columns(company: bool = True, active: bool = True):
    cols = []
    if company:
        cols.append(sa.Column("company_id", sa.Integer(), nullable=False, index=True))
    cols.extend([
        sa.Column("create_uid", sa.Integer(), nullable=True),
        sa.Column("write_uid", sa.Integer(), nullable=True),
        sa.Column("create_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("write_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    ])
    if active:
        cols.append(sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")))
    return cols


def upgrade() -> None:
    op.create_table(
        "res_company",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("legal_name", sa.String(220)),
        sa.Column("vat", sa.String(64)),
        sa.Column("email", sa.String(160)),
        sa.Column("phone", sa.String(64)),
        sa.Column("website", sa.String(180)),
        sa.Column("street", sa.String(220)),
        sa.Column("city", sa.String(120)),
        sa.Column("country", sa.String(120)),
        sa.Column("timezone", sa.String(80), nullable=False, server_default="America/El_Salvador"),
        sa.Column("plan", sa.String(80), nullable=False, server_default="starter"),
        sa.Column("state", sa.String(40), nullable=False, server_default="active"),
        *audit_columns(company=False, active=True),
    )
    op.create_table(
        "x_branch",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("code", sa.String(64), index=True),
        sa.Column("street", sa.String(220)),
        sa.Column("city", sa.String(120)),
        sa.Column("country", sa.String(120)),
        sa.Column("timezone", sa.String(80), nullable=False, server_default="America/El_Salvador"),
        *audit_columns(),
    )
    op.create_table(
        "res_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), index=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("login", sa.String(120), nullable=False, unique=True, index=True),
        sa.Column("email", sa.String(160), unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("pin_hash", sa.String(255)),
        sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_company_admin", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_login", sa.DateTime()),
        *audit_columns(),
    )
    op.create_table("hr_department", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(180), nullable=False), sa.Column("manager_id", sa.Integer()), *audit_columns())
    op.create_table("hr_job", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(180), nullable=False), sa.Column("description", sa.Text()), *audit_columns())
    op.create_table(
        "x_employee_status",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("code", sa.String(80), nullable=False, index=True),
        sa.Column("allows_check_in", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("allows_assignments", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("requires_note", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_terminated", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_suspended", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_incapacitated", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_rehire", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        *audit_columns(),
    )
    op.create_table(
        "hr_employee",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("branch_id", sa.Integer(), index=True),
        sa.Column("user_id", sa.Integer(), index=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("first_name", sa.String(120)),
        sa.Column("last_name", sa.String(120)),
        sa.Column("employee_code", sa.String(80), index=True),
        sa.Column("work_email", sa.String(160)),
        sa.Column("work_phone", sa.String(64)),
        sa.Column("mobile_phone", sa.String(64)),
        sa.Column("department_id", sa.Integer(), index=True),
        sa.Column("job_id", sa.Integer(), index=True),
        sa.Column("job_title", sa.String(160)),
        sa.Column("employee_type", sa.String(40), nullable=False, server_default="fixed"),
        sa.Column("employment_status_id", sa.Integer(), index=True),
        sa.Column("hire_date", sa.Date()),
        sa.Column("termination_date", sa.Date()),
        sa.Column("rehire_date", sa.Date()),
        sa.Column("is_active_for_work", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("notes", sa.Text()),
        *audit_columns(),
    )
    op.create_table(
        "x_employee_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=False, index=True),
        sa.Column("old_status_id", sa.Integer()),
        sa.Column("new_status_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("changed_by", sa.Integer()),
        sa.Column("changed_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        *audit_columns(active=False),
    )
    op.create_table("x_role", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("description", sa.Text()), *audit_columns())
    op.create_table(
        "x_permission",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(120), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("category", sa.String(80), nullable=False, index=True),
        sa.Column("description", sa.Text()),
        *audit_columns(company=False),
    )
    op.create_table(
        "x_role_permission",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("role_id", sa.Integer(), nullable=False, index=True),
        sa.Column("permission_id", sa.Integer(), nullable=False, index=True),
        sa.Column("create_uid", sa.Integer()),
        sa.Column("create_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_table(
        "x_employee_role",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=False, index=True),
        sa.Column("role_id", sa.Integer(), nullable=False, index=True),
        sa.Column("create_uid", sa.Integer()),
        sa.Column("create_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )


def downgrade() -> None:
    for table in ["x_employee_role", "x_role_permission", "x_permission", "x_role", "x_employee_status_history", "hr_employee", "x_employee_status", "hr_job", "hr_department", "res_users", "x_branch", "res_company"]:
        op.drop_table(table)
