from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ResCompany, ResUser, XAssignmentQuestion, XAssignmentTemplate, XAttendanceEventType, XAutoCheckoutRule, XEmployeeStatus, XPermission, XRole, XRolePermission
from app.security.auth import hash_secret
import os
from app.services.employee_defaults import resolve_org_defaults
from app.services.schedules import ensure_default_schedule

PERMISSIONS = {
    "Employee": [
        "employee.create", "employee.read", "employee.update", "employee.deactivate", "employee.change_status", "employee.rehire", "employee.assign_role", "employee.assign_branch",
    ],
    "Attendance": [
        "attendance.own_check_in", "attendance.own_check_out", "attendance.view_own", "attendance.view_team", "attendance.view_all", "attendance.edit_own", "attendance.edit_team", "attendance.edit_all", "attendance.excuse_absence",
    ],
    "Roles": ["role.create", "role.update", "role.assign_permission", "role.assign_employee"],
    "Admin": ["company.update", "branch.create", "branch.update", "device.create", "device.update", "system.settings"],
}



EVENT_TYPES = [
    {"name": "Entra a jornada", "code": "shift_in", "direction": "in", "opens_shift": True, "counts_as_worked_time": True, "allows_assignments_after": True, "sequence": 10},
    {"name": "Sale a break", "code": "break_out", "direction": "out", "counts_as_worked_time": False, "counts_as_break": True, "sequence": 20},
    {"name": "Entra de break", "code": "break_in", "direction": "in", "counts_as_worked_time": True, "sequence": 30},
    {"name": "Sale a comida", "code": "meal_out", "direction": "out", "counts_as_worked_time": False, "counts_as_meal": True, "sequence": 40},
    {"name": "Entra de comida", "code": "meal_in", "direction": "in", "counts_as_worked_time": True, "sequence": 50},
    {"name": "Salida final", "code": "shift_out", "direction": "out", "closes_shift": True, "counts_as_worked_time": False, "blocks_assignments_after": True, "sequence": 60},
]

STATUSES = [
    {"name": "De alta", "code": "active"},
    {"name": "Despedido", "code": "terminated", "allows_check_in": False, "allows_assignments": False, "is_terminated": True},
    {"name": "Recontratado", "code": "rehired", "is_rehire": True},
    {"name": "Suspendido", "code": "suspended", "allows_check_in": False, "allows_assignments": False, "is_suspended": True},
    {"name": "Incapacitado", "code": "incapacitated", "allows_check_in": False, "allows_assignments": False, "is_incapacitated": True},
    {"name": "Inactivo", "code": "inactive", "allows_check_in": False, "allows_assignments": False},
]


def seed(db: Session) -> None:
    from app.config import get_settings
    if get_settings().environment.lower() == "production":
        raise RuntimeError("Development initialization is disabled in production; provision the administrator securely.")
    admin_login = os.getenv("BOOTSTRAP_ADMIN_LOGIN", "admin").strip()
    admin_name = os.getenv("BOOTSTRAP_ADMIN_NAME", "Administrador del Sistema").strip()
    admin_password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")
    if not admin_login or not admin_name or len(admin_password) < 14 or "change_me" in admin_password.lower():
        raise RuntimeError("Define BOOTSTRAP_ADMIN_LOGIN, BOOTSTRAP_ADMIN_NAME y BOOTSTRAP_ADMIN_PASSWORD (14 caracteres minimo) en .env")

    company_name = os.getenv("BOOTSTRAP_COMPANY_NAME", "Empresa Principal").strip()
    company = db.query(ResCompany).filter_by(name=company_name).first()
    if not company:
        company = ResCompany(name=company_name, legal_name=company_name, country="Guatemala", create_uid=1, write_uid=1)
        db.add(company)
        db.flush()

    admin = db.query(ResUser).filter_by(login=admin_login).first()
    if not admin:
        admin = ResUser(
            company_id=company.id,
            name=admin_name,
            login=admin_login,
            email=os.getenv("BOOTSTRAP_ADMIN_EMAIL") or None,
            password_hash=hash_secret(admin_password),
            is_superadmin=True,
            is_company_admin=True,
            create_uid=1,
            write_uid=1,
        )
        db.add(admin)
        db.flush()
    else:
        admin.name = admin_name
        admin.email = os.getenv("BOOTSTRAP_ADMIN_EMAIL") or None
        admin.is_superadmin = True
        admin.is_company_admin = True
        db.flush()

    for item in STATUSES:
        exists = db.query(XEmployeeStatus).filter_by(company_id=company.id, code=item["code"]).first()
        if not exists:
            db.add(XEmployeeStatus(company_id=company.id, create_uid=admin.id, write_uid=admin.id, **item))

    permission_ids = []
    for category, codes in PERMISSIONS.items():
        for code in codes:
            permission = db.query(XPermission).filter_by(code=code).first()
            if not permission:
                permission = XPermission(code=code, name=code.replace(".", " ").title(), category=category, create_uid=admin.id, write_uid=admin.id)
                db.add(permission)
                db.flush()
            permission_ids.append(permission.id)

    admin_role = db.query(XRole).filter_by(company_id=company.id, name="Company Admin").first()
    if not admin_role:
        admin_role = XRole(company_id=company.id, name="Company Admin", description="Full tenant administration", create_uid=admin.id, write_uid=admin.id)
        db.add(admin_role)
        db.flush()

    current = {rp.permission_id for rp in db.query(XRolePermission).filter_by(role_id=admin_role.id).all()}
    for permission_id in permission_ids:
        if permission_id not in current:
            db.add(XRolePermission(role_id=admin_role.id, permission_id=permission_id, create_uid=admin.id))


    for item in EVENT_TYPES:
        exists = db.query(XAttendanceEventType).filter_by(company_id=company.id, code=item["code"]).first()
        if not exists:
            db.add(XAttendanceEventType(company_id=company.id, create_uid=admin.id, write_uid=admin.id, **item))

    resolve_org_defaults(db, company.id, admin.id, create_branch=False)

    template = db.query(XAssignmentTemplate).filter_by(company_id=company.id, name="Tareas del día").first()
    if not template:
        template = XAssignmentTemplate(
            company_id=company.id,
            name="Tareas del día",
            description="Checklist operativo diario",
            state="active",
            create_uid=admin.id,
            write_uid=admin.id,
        )
        db.add(template)
        db.flush()
        db.add(XAssignmentQuestion(
            company_id=company.id,
            template_id=template.id,
            name="Apertura",
            question_text="¿Completó las tareas de apertura asignadas?",
            question_type="boolean",
            required=True,
            sequence=10,
            create_uid=admin.id,
            write_uid=admin.id,
        ))

    checkout = db.query(XAutoCheckoutRule).filter_by(company_id=company.id, checkout_time="03:00").first()
    if not checkout:
        db.add(XAutoCheckoutRule(
            company_id=company.id,
            auto_checkout_enabled=True,
            checkout_time="03:00",
            timezone="America/El_Salvador",
            note="Cierre automático al final de jornada (11:00 – 03:00)",
            create_uid=admin.id,
            write_uid=admin.id,
        ))

    ensure_default_schedule(db, company.id, admin.id)
    db.commit()


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
        print("Seed completado exitosamente.")
        print("Administrador inicial creado con las credenciales privadas configuradas en .env.")
    finally:
        db.close()
