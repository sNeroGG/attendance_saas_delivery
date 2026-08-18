"""add device_lock_enabled to res_company

Revision ID: 0010_add_company_device_lock
Revises: 4458154d206f
Create Date: 2026-08-12 19:40:00.000000

"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa


revision: str = "0010_add_company_device_lock"
down_revision: str | None = "4458154d206f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("res_company")]
    if "device_lock_enabled" not in columns:
        op.add_column(
            "res_company",
            sa.Column("device_lock_enabled", sa.Boolean(), nullable=False, server_default="1"),
        )


def downgrade() -> None:
    op.drop_column("res_company", "device_lock_enabled")
