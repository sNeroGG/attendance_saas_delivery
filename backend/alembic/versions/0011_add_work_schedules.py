"""add work schedules and assignment fields

Revision ID: 0011_add_work_schedules
Revises: 0010_add_company_device_lock
Create Date: 2026-08-18 11:40:00.000000

"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa


revision: str = "0011_add_work_schedules"
down_revision: str | None = "0010_add_company_device_lock"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(inspector, table: str, column: str) -> bool:
    if table not in inspector.get_table_names():
        return False
    return column in [item["name"] for item in inspector.get_columns(table)]


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "x_work_schedule" not in tables:
        op.create_table(
            "x_work_schedule",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), nullable=False, index=True),
            sa.Column("name", sa.String(180), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("timezone", sa.String(80), nullable=False, server_default="America/El_Salvador"),
            sa.Column("is_default", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("create_uid", sa.Integer(), nullable=True),
            sa.Column("write_uid", sa.Integer(), nullable=True),
            sa.Column("create_date", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("write_date", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    if "x_work_schedule_line" not in tables:
        op.create_table(
            "x_work_schedule_line",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), nullable=False, index=True),
            sa.Column("schedule_id", sa.Integer(), nullable=False, index=True),
            sa.Column("weekday", sa.Integer(), nullable=False),
            sa.Column("start_time", sa.String(8), nullable=False, server_default="11:00"),
            sa.Column("end_time", sa.String(8), nullable=False, server_default="03:00"),
            sa.Column("is_off", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("overnight", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("create_uid", sa.Integer(), nullable=True),
            sa.Column("write_uid", sa.Integer(), nullable=True),
            sa.Column("create_date", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("write_date", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    if not _has_column(inspector, "res_company", "default_schedule_id"):
        op.add_column("res_company", sa.Column("default_schedule_id", sa.Integer(), nullable=True))
    if not _has_column(inspector, "hr_employee", "schedule_id"):
        op.add_column("hr_employee", sa.Column("schedule_id", sa.Integer(), nullable=True))
    if not _has_column(inspector, "x_role", "schedule_id"):
        op.add_column("x_role", sa.Column("schedule_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("x_role", "schedule_id")
    op.drop_column("hr_employee", "schedule_id")
    op.drop_column("res_company", "default_schedule_id")
    op.drop_table("x_work_schedule_line")
    op.drop_table("x_work_schedule")
