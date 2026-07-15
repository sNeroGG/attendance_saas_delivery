"""restore face id

Revision ID: 0008_restore_face_id
Revises: 0007_add_temporary_manager_pin
Create Date: 2026-07-15
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0008_restore_face_id"
down_revision: str | None = "0007_add_temporary_manager_pin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create biometric tables
    op.create_table(
        "x_face_template",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=False, index=True),
        sa.Column("face_encoding", sa.Text(), nullable=False),
        sa.Column("face_feature", sa.Text(), nullable=True),
        sa.Column("provider", sa.String(40), nullable=False, server_default="opencv"),
        sa.Column("confidence_threshold", sa.Float(), nullable=False, server_default="0.40"),
        sa.Column("company_id", sa.Integer(), nullable=False, index=True),
        sa.Column("create_uid", sa.Integer()),
        sa.Column("write_uid", sa.Integer()),
        sa.Column("create_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("write_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
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
    
    # 2. Re-add columns to x_attendance_event_type
    op.add_column("x_attendance_event_type", sa.Column("requires_face_id", sa.Boolean(), nullable=False, server_default=sa.text("0")))
    op.add_column("x_attendance_event_type", sa.Column("allows_pin", sa.Boolean(), nullable=False, server_default=sa.text("1")))


def downgrade() -> None:
    # 1. Drop columns from x_attendance_event_type
    op.drop_column("x_attendance_event_type", "requires_face_id")
    op.drop_column("x_attendance_event_type", "allows_pin")
    
    # 2. Drop biometric tables
    op.drop_table("x_face_template")
    op.drop_table("x_biometric_log")
