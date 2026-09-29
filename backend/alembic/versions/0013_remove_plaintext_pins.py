"""remove plaintext employee PINs

Revision ID: 0013_remove_plaintext_pins
Revises: 0012_add_event_punctuality
Create Date: 2026-09-29
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa


revision: str = "0013_remove_plaintext_pins"
down_revision: str | None = "0012_add_event_punctuality"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "pin_plain" in [column["name"] for column in inspector.get_columns("res_users")]:
        op.drop_column("res_users", "pin_plain")


def downgrade() -> None:
    # Plaintext PINs are intentionally not recoverable; restored values remain NULL.
    inspector = sa.inspect(op.get_bind())
    if "pin_plain" not in [column["name"] for column in inspector.get_columns("res_users")]:
        op.add_column("res_users", sa.Column("pin_plain", sa.String(length=40), nullable=True))
