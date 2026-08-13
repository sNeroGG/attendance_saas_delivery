from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AssignmentTemplateIn(BaseModel):
    name: str
    description: str | None = None
    state: str = "draft"
    active: bool = True


class AssignmentTemplateOut(AssignmentTemplateIn, ORMModel):
    id: int
    company_id: int


class AssignmentQuestionIn(BaseModel):
    name: str
    question_text: str
    question_type: str = "short_text"
    options_json: str | None = None
    required: bool = True
    requires_evidence: bool = False
    requires_supervisor_validation: bool = False
    sequence: int = 10
    active: bool = True


class AssignmentQuestionOut(AssignmentQuestionIn, ORMModel):
    id: int
    company_id: int
    template_id: int


class EmployeeAssignmentOut(ORMModel):
    id: int
    company_id: int
    employee_id: int
    shift_id: int | None
    template_id: int
    assigned_at: datetime
    due_at: datetime | None
    required: bool
    blocks_check_in: bool
    blocks_check_out: bool
    state: str
    applied_rule_id: int | None
    template_name: str | None = None
    employee_name: str | None = None


class AssignmentAnswerIn(BaseModel):
    question_id: int
    answer_text: str | None = None
    answer_number: float | None = None
    answer_boolean: bool | None = None
    answer_json: str | None = None
    evidence_url: str | None = None


class SaveAssignmentAnswersRequest(BaseModel):
    answers: list[AssignmentAnswerIn]


class AssignmentAnswerOut(AssignmentAnswerIn, ORMModel):
    id: int
    company_id: int
    employee_assignment_id: int
    answered_by: int | None
    answered_at: datetime | None
    state: str


class SupervisorValidationRequest(BaseModel):
    supervisor_pin: str
    notes: str | None = None


class AssignmentValidationOut(ORMModel):
    id: int
    company_id: int
    employee_assignment_id: int
    supervisor_id: int
    method: str
    result: str
    notes: str | None
    validated_at: datetime


class RuleIn(BaseModel):
    name: str
    rule_type: str = "assignment"
    employee_id: int | None = None
    role_id: int | None = None
    branch_id: int | None = None
    event_type_id: int | None = None
    assignment_template_id: int | None = None
    priority: int = 100
    frequency_type: str = "per_shift"
    frequency_value: str | None = None
    required: bool = True
    blocks_check_in: bool = False
    blocks_check_out: bool = False
    requires_supervisor_validation: bool = False
    requires_note: bool = False
    requires_evidence: bool = False
    active: bool = True


class RuleOut(RuleIn, ORMModel):
    id: int
    company_id: int


class EmployeeAssignmentIn(BaseModel):
    employee_id: int
    template_id: int
    required: bool = True
    blocks_check_in: bool = False
    blocks_check_out: bool = False
    state: str = "pending"
