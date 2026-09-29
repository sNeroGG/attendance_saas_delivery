"""remove stored raw face captures

Revision ID: 0014_remove_raw_face_images
Revises: 0013_remove_plaintext_pins
Create Date: 2026-09-29
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa


revision: str = "0014_remove_raw_face_images"
down_revision: str | None = "0013_remove_plaintext_pins"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.alter_column("x_face_template", "face_encoding", existing_type=sa.Text(), nullable=True)
    # Production biometrics are disabled until privacy controls exist; purge old captures and vectors.
    op.execute("DELETE FROM x_face_template")


def downgrade() -> None:
    # Deleted biometric data cannot be reconstructed.
    pass
