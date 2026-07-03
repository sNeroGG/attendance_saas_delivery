"""phase 3 assignments and rules

Revision ID: 0003_phase3_assignments
Revises: 0002_phase2_attendance
Create Date: 2026-06-26
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "0003_phase3_assignments"
down_revision: str | None = "0002_phase2_attendance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def audit_columns(company: bool = True, active: bool = False):
    cols = []
    if company:
        cols.append(sa.Column("company_id", sa.Integer(), nullable=False, index=True))
    cols.extend([
        sa.Column("create_uid", sa.Integer()),
        sa.Column("write_uid", sa.Integer()),
        sa.Column("create_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("write_date", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    ])
    if active:
        cols.append(sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")))
    return cols


def upgrade() -> None:
    op.create_table(
        "x_assignment_template",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("state", sa.String(40), nullable=False, server_default="draft"),
        *audit_columns(active=True),
    )
    op.create_table(
        "x_assignment_question",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("template_id", sa.Integer(), nullable=False, index=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("question_type", sa.String(40), nullable=False, server_default="short_text"),
        sa.Column("options_json", sa.Text()),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("requires_evidence", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("requires_supervisor_validation", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="10"),
        *audit_columns(active=True),
    )
    op.create_table(
        "x_employee_assignment",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=False, index=True),
        sa.Column("shift_id", sa.Integer(), index=True),
        sa.Column("template_id", sa.Integer(), nullable=False, index=True),
        sa.Column("assigned_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("due_at", sa.DateTime()),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("blocks_check_in", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("blocks_check_out", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("state", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("applied_rule_id", sa.Integer(), index=True),
        *audit_columns(),
    )
    op.create_table(
        "x_assignment_answer",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_assignment_id", sa.Integer(), nullable=False, index=True),
        sa.Column("question_id", sa.Integer(), nullable=False, index=True),
        sa.Column("answer_text", sa.Text()),
        sa.Column("answer_number", sa.Float()),
        sa.Column("answer_boolean", sa.Boolean()),
        sa.Column("answer_json", sa.Text()),
        sa.Column("evidence_url", sa.String(500)),
        sa.Column("answered_by", sa.Integer()),
        sa.Column("answered_at", sa.DateTime()),
        sa.Column("state", sa.String(40), nullable=False, server_default="done"),
        *audit_columns(),
    )
    op.create_table(
        "x_assignment_validation",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_assignment_id", sa.Integer(), nullable=False, index=True),
        sa.Column("supervisor_id", sa.Integer(), nullable=False, index=True),
        sa.Column("method", sa.String(40), nullable=False, server_default="supervisor_pin"),
        sa.Column("result", sa.String(40), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("validated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        *audit_columns(),
    )
    op.create_table(
        "x_rule",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("rule_type", sa.String(40), nullable=False, index=True),
        sa.Column("employee_id", sa.Integer(), index=True),
        sa.Column("role_id", sa.Integer(), index=True),
        sa.Column("branch_id", sa.Integer(), index=True),
        sa.Column("event_type_id", sa.Integer(), index=True),
        sa.Column("assignment_template_id", sa.Integer(), index=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("frequency_type", sa.String(40), nullable=False, server_default="per_shift"),
        sa.Column("frequency_value", sa.String(120)),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("blocks_check_in", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("blocks_check_out", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("requires_supervisor_validation", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("requires_note", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("requires_evidence", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        *audit_columns(active=True),
    )


def downgrade() -> None:
    for table in ["x_rule", "x_assignment_validation", "x_assignment_answer", "x_employee_assignment", "x_assignment_question", "x_assignment_template"]:
        op.drop_table(table)
