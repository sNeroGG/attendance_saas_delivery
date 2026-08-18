"""add punctuality to attendance events

Revision ID: 0012_add_event_punctuality
Revises: 0011_add_work_schedules
Create Date: 2026-08-18 12:10:00.000000

"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa


revision: str = "0012_add_event_punctuality"
down_revision: str | None = "0011_add_work_schedules"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("x_attendance_event")]
    if "punctuality" not in columns:
        op.add_column("x_attendance_event", sa.Column("punctuality", sa.String(40), nullable=True))


def downgrade() -> None:
    op.drop_column("x_attendance_event", "punctuality")
