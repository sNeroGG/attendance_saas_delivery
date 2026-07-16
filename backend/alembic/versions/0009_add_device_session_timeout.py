"""add device session timeout

Revision ID: 0009_add_device_session_timeout
Revises: 0008_restore_face_id
Create Date: 2026-07-16
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0009_add_device_session_timeout"
down_revision: str | None = "0008_restore_face_id"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('x_device')]
    if 'session_timeout' not in columns:
        op.add_column("x_device", sa.Column("session_timeout", sa.Integer(), nullable=False, server_default="30"))


def downgrade() -> None:
    op.drop_column("x_device", "session_timeout")
