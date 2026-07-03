"""phase 2 attendance core

Revision ID: 0002_phase2_attendance
Revises: 0001_phase1_core
Create Date: 2026-06-26
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0002_phase2_attendance"
down_revision: str | None = "0001_phase1_core"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def audit_columns(company: bool = True, active: bool = False):
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
        "x_device",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("branch_id", sa.Integer(), index=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("device_code", sa.String(80), nullable=False, unique=True, index=True),
        sa.Column("device_type", sa.String(40), nullable=False, server_default="kiosk"),
        sa.Column("last_ip", sa.String(80)),
        sa.Column("last_seen_at", sa.DateTime()),
        *audit_columns(active=True),
    )
    op.create_table(
        "x_attendance_event_type",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("code", sa.String(80), nullable=False, index=True),
        sa.Column("direction", sa.String(20), nullable=False),
        sa.Column("opens_shift", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("closes_shift", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("counts_as_worked_time", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("counts_as_break", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("counts_as_meal", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("counts_as_non_worked", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("allows_assignments_after", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("blocks_assignments_after", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("requires_face_id", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("allows_pin", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("requires_supervisor_validation", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("requires_note", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("requires_evidence", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="10"),
        *audit_columns(active=True),
    )
    op.create_table(
        "x_attendance_shift",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=False, index=True),
        sa.Column("branch_id", sa.Integer(), index=True),
        sa.Column("check_in_at", sa.DateTime(), nullable=False),
        sa.Column("check_out_at", sa.DateTime()),
        sa.Column("total_time_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("worked_time_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("break_time_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("meal_time_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("non_worked_time_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("auto_closed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("state", sa.String(40), nullable=False, server_default="open"),
        sa.Column("note", sa.Text()),
        *audit_columns(),
    )
    op.create_table(
        "x_attendance_event",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=False, index=True),
        sa.Column("branch_id", sa.Integer(), index=True),
        sa.Column("device_id", sa.Integer(), index=True),
        sa.Column("event_type_id", sa.Integer(), nullable=False, index=True),
        sa.Column("shift_id", sa.Integer(), index=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("method", sa.String(40), nullable=False, server_default="pin"),
        sa.Column("supervisor_id", sa.Integer()),
        sa.Column("confidence_score", sa.Float()),
        sa.Column("note", sa.Text()),
        sa.Column("evidence_url", sa.String(500)),
        sa.Column("source", sa.String(40), nullable=False, server_default="kiosk"),
        sa.Column("state", sa.String(40), nullable=False, server_default="done"),
        *audit_columns(),
    )
    op.create_table(
        "hr_attendance",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=False, index=True),
        sa.Column("check_in", sa.DateTime(), nullable=False),
        sa.Column("check_out", sa.DateTime()),
        sa.Column("worked_hours", sa.Float(), nullable=False, server_default="0"),
        sa.Column("x_shift_id", sa.Integer(), unique=True, index=True),
        sa.Column("x_source", sa.String(80)),
        sa.Column("x_external_reference", sa.String(160)),
        *audit_columns(),
    )
    op.create_table(
        "x_no_attendance_note",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=False, index=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(160), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("evidence_url", sa.String(500)),
        sa.Column("state", sa.String(40), nullable=False, server_default="draft"),
        *audit_columns(),
    )


def downgrade() -> None:
    for table in ["x_no_attendance_note", "hr_attendance", "x_attendance_event", "x_attendance_shift", "x_attendance_event_type", "x_device"]:
        op.drop_table(table)
