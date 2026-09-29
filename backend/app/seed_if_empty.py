"""Prepare the single local admin and retire legacy test accounts on startup."""

from app.config import get_settings
from app.database import SessionLocal
import os

from app.models import HrEmployee, ResCompany, ResUser, XDevice
from app.security.auth import hash_secret
from app.seed import seed


def main() -> None:
    if get_settings().environment.lower() != "development":
        raise RuntimeError("The local first-run setup is available only in development")

    db = SessionLocal()
    try:
        admin_login = os.getenv("BOOTSTRAP_ADMIN_LOGIN", "admin").strip()
        admin_password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")
        if len(admin_password) < 14 or "change_me" in admin_password.lower():
            raise RuntimeError("Configura una contraseña BOOTSTRAP_ADMIN_PASSWORD de 14 caracteres o más en .env")

        admin = db.query(ResUser).filter_by(login=admin_login).first()
        if not admin:
            if db.query(ResUser.id).filter(ResUser.is_superadmin.is_(True), ResUser.active.is_(True)).first():
                raise RuntimeError("Ya hay otro superadministrador activo. Resuelve la cuenta antes de inicializar.")
            seed(db)
            admin = db.query(ResUser).filter_by(login=admin_login).first()

        admin.name = os.getenv("BOOTSTRAP_ADMIN_NAME", "Administrador").strip()
        admin.password_hash = hash_secret(admin_password)
        admin.pin_hash = None
        admin.is_superadmin = True
        admin.is_company_admin = True
        admin.active = True

        company = db.get(ResCompany, admin.company_id)
        if company:
            company.name = os.getenv("BOOTSTRAP_COMPANY_NAME", "Empresa Principal").strip()
            company.legal_name = company.name

        # Retire only the fixed legacy fixture accounts from older local installs.
        for fixture_login in ("supervisor", "juan_perez", "juan"):
            fixture = db.query(ResUser).filter_by(login=fixture_login).first()
            if fixture and fixture.id != admin.id:
                fixture.active = False
                employee = db.get(HrEmployee, fixture.employee_id) if fixture.employee_id else None
                if employee:
                    employee.active = False
                    employee.is_active_for_work = False
        legacy_device = db.query(XDevice).filter_by(device_code="KIOSK-DEMO").first()
        if legacy_device:
            legacy_device.active = False
        for other_admin in db.query(ResUser).filter(
            ResUser.is_superadmin.is_(True), ResUser.id != admin.id
        ).all():
            other_admin.active = False
        db.commit()
    finally:
        db.close()

    print("Administrador local listo. Crea empleados desde el panel administrativo.")


if __name__ == "__main__":
    main()
