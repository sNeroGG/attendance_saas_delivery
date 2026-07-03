"""phase 4 biometrics audit reports

Revision ID: 0004_phase4_biometrics
Revises: 0003_phase3_assignments
Create Date: 2026-06-26
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0004_phase4_biometrics"
down_revision: str | None = "0003_phase3_assignments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def audit_columns(company: bool = True, active: bool = False):
    cols = []
    if company:
        cols.append(sa.Column("company_id", sa.Integer(), nullable=False, index=True))
    cols.extend([
        sa.Column("create_uid", sa.Integer()),
        sa.Column("write_uid", sa.Integer()),
        sa.Column("create_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("write_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    ])
    if active:
        cols.append(sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")))
    return cols


def upgrade() -> None:
    op.create_table(
        "x_face_template",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=False, index=True),
        sa.Column("face_encoding", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(40), nullable=False, server_default="mock"),
        sa.Column("confidence_threshold", sa.Float(), nullable=False, server_default="0.75"),
        *audit_columns(active=True),
    )
    op.create_table(
        "x_biometric_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), index=True),
        sa.Column("device_id", sa.Integer(), index=True),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("method", sa.String(40), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("confidence_score", sa.Float()),
        sa.Column("failure_reason", sa.String(255)),
        sa.Column("ip_address", sa.String(80)),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False, index=True),
    )
    op.create_table(
        "x_audit_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), nullable=False, index=True),
        sa.Column("user_id", sa.Integer(), index=True),
        sa.Column("employee_id", sa.Integer(), index=True),
        sa.Column("action", sa.String(120), nullable=False, index=True),
        sa.Column("model_name", sa.String(120), nullable=False, index=True),
        sa.Column("record_id", sa.Integer(), index=True),
        sa.Column("field_name", sa.String(120)),
        sa.Column("old_value", sa.Text()),
        sa.Column("new_value", sa.Text()),
        sa.Column("reason", sa.Text()),
        sa.Column("device_id", sa.Integer(), index=True),
        sa.Column("ip_address", sa.String(80)),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("create_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_table(
        "x_auto_checkout_rule",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("branch_id", sa.Integer(), index=True),
        sa.Column("role_id", sa.Integer(), index=True),
        sa.Column("employee_id", sa.Integer(), index=True),
        sa.Column("auto_checkout_enabled", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("checkout_time", sa.String(10), nullable=False, server_default="18:00"),
        sa.Column("timezone", sa.String(80), nullable=False, server_default="America/El_Salvador"),
        sa.Column("note", sa.Text()),
        *audit_columns(active=True),
    )


def downgrade() -> None:
    for table in ["x_auto_checkout_rule", "x_audit_log", "x_biometric_log", "x_face_template"]:
        op.drop_table(table)
