from sqlalchemy.orm import Session

from app.models import HrDepartment, HrEmployee, HrJob, XAssignmentTemplate, XBranch, XEmployeeAssignment, XEmployeeStatus
from app.services.operational_day import merge_employee_defaults
from app.services.schedules import ensure_default_schedule


def next_employee_code(db: Session, company_id: int) -> str:
    count = db.query(HrEmployee).filter_by(company_id=company_id).count()
    for offset in range(1, 1000):
        code = f"EMP-{str(count + offset).zfill(3)}"
        exists = db.query(HrEmployee).filter_by(company_id=company_id, employee_code=code).first()
        if not exists:
            return code
    return f"EMP-{count + 1}"


def _get_or_create(db: Session, model, company_id: int, user_id: int, defaults: dict, **lookup):
    record = db.query(model).filter_by(company_id=company_id, **lookup).first()
    if record:
        return record
    record = model(company_id=company_id, create_uid=user_id, write_uid=user_id, **defaults, **lookup)
    db.add(record)
    db.flush()
    return record


def resolve_org_defaults(db: Session, company_id: int, user_id: int) -> dict:
    branch = _get_or_create(
        db, XBranch, company_id, user_id,
        {"timezone": "America/El_Salvador", "active": True},
        name="Sucursal Principal",
    )
    department = _get_or_create(
        db, HrDepartment, company_id, user_id,
        {"active": True},
        name="Operaciones",
    )
    job = _get_or_create(
        db, HrJob, company_id, user_id,
        {"description": "Puesto operativo por defecto", "active": True},
        name="Colaborador",
    )
    status = db.query(XEmployeeStatus).filter_by(company_id=company_id, code="active").first()
    if not status:
        status = _get_or_create(
            db, XEmployeeStatus, company_id, user_id,
            {"name": "De alta", "allows_check_in": True, "allows_assignments": True, "active": True},
            code="active",
        )
    ensure_default_schedule(db, company_id, user_id)
    return {
        "branch_id": branch.id,
        "department_id": department.id,
        "job_id": job.id,
        "job_title": job.name,
        "employment_status_id": status.id,
    }


def apply_employee_defaults(db: Session, company_id: int, user_id: int, data: dict) -> dict:
    org = resolve_org_defaults(db, company_id, user_id)
    return merge_employee_defaults(data, org, next_employee_code(db, company_id))


def assign_templates(db: Session, company_id: int, user_id: int, employee_id: int, template_ids: list[int]) -> list[XEmployeeAssignment]:
    created: list[XEmployeeAssignment] = []
    for template_id in template_ids:
        template = db.query(XAssignmentTemplate).filter_by(id=template_id, company_id=company_id, active=True).first()
        if not template:
            continue
        record = XEmployeeAssignment(
            company_id=company_id,
            employee_id=employee_id,
            template_id=template.id,
            required=True,
            blocks_check_in=False,
            blocks_check_out=True,
            state="pending",
            create_uid=user_id,
            write_uid=user_id,
        )
        db.add(record)
        db.flush()
        created.append(record)
    return created
