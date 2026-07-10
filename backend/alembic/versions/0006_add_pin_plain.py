"""add pin plain to res users

Revision ID: 0006_add_pin_plain
Revises: 0005_remove_face_id
Create Date: 2026-07-10
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0006_add_pin_plain"
down_revision: str | None = "0005_remove_face_id"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("res_users", sa.Column("pin_plain", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("res_users", "pin_plain")
