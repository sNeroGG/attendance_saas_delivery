"""add temporary manager pin

Revision ID: 0007_add_temporary_manager_pin
Revises: 0006_add_pin_plain
Create Date: 2026-07-10
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0007_add_temporary_manager_pin"
down_revision: str | None = "0006_add_pin_plain"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "x_manager_temporary_pin",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), nullable=False, index=True),
        sa.Column("pin", sa.String(length=20), nullable=False, index=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("x_manager_temporary_pin")
