"""add device_lock_enabled and locked_employee_id to x_device

Revision ID: 4458154d206f
Revises: b34f86846702
Create Date: 2026-07-18 08:02:03.117880

"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4458154d206f'
down_revision: str | None = 'b34f86846702'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('x_device')]
    if 'device_lock_enabled' not in columns:
        op.add_column("x_device", sa.Column("device_lock_enabled", sa.Boolean(), nullable=False, server_default="1"))
    if 'locked_employee_id' not in columns:
        op.add_column("x_device", sa.Column("locked_employee_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("x_device", "locked_employee_id")
    op.drop_column("x_device", "device_lock_enabled")
