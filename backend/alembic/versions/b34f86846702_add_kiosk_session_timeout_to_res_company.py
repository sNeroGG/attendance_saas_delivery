"""add kiosk_session_timeout to res_company

Revision ID: b34f86846702
Revises: 0009_add_device_session_timeout
Create Date: 2026-07-18 07:42:11.865442

"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b34f86846702'
down_revision: str | None = '0009_add_device_session_timeout'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('res_company')]
    if 'kiosk_session_timeout' not in columns:
        op.add_column("res_company", sa.Column("kiosk_session_timeout", sa.Integer(), nullable=False, server_default="30"))


def downgrade() -> None:
    op.drop_column("res_company", "kiosk_session_timeout")
