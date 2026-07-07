from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import HrEmployee, ResCompany, ResUser, XEmployeeStatus, XDevice
from app.security.auth import hash_secret

def create_test_setup():
    db = SessionLocal()
    try:
        company = db.query(ResCompany).filter_by(name="Demo Company").first()
        admin = db.query(ResUser).filter_by(login="admin").first()
        if not company or not admin:
            print("Error: Empresa Demo o Admin no encontrados. Ejecute el seed primero.")
            return

        # 1. Crear el dispositivo KIOSK-01
        device = db.query(XDevice).filter_by(company_id=company.id, device_code="KIOSK-01").first()
        if not device:
            device = XDevice(
                company_id=company.id,
                name="Kiosko Principal",
                device_code="KIOSK-01",
                device_type="kiosk",
                create_uid=admin.id,
                write_uid=admin.id
            )
            db.add(device)
            db.flush()
            print("Dispositivo KIOSK-01 registrado.")

        # 2. Crear el empleado Juan Pérez
        active_status = db.query(XEmployeeStatus).filter_by(company_id=company.id, code="active").first()
        employee = db.query(HrEmployee).filter_by(company_id=company.id, employee_code="EMP-JUAN").first()
        if not employee:
            employee = HrEmployee(
                company_id=company.id,
                name="Juan Pérez",
                first_name="Juan",
                last_name="Pérez",
                employee_code="EMP-JUAN",
                work_email="juan@example.com",
                employee_type="fixed",
                employment_status_id=active_status.id if active_status else None,
                is_active_for_work=True,
                create_uid=admin.id,
                write_uid=admin.id,
            )
            db.add(employee)
            db.flush()
            print("Empleado 'Juan Pérez' (EMP-JUAN) creado.")

        # 3. Crear el usuario juan con PIN 4321
        user = db.query(ResUser).filter_by(company_id=company.id, login="juan").first()
        if not user:
            user = ResUser(
                company_id=company.id,
                employee_id=employee.id,
                name="Juan Pérez",
                login="juan",
                email="juan@example.com",
                password_hash=hash_secret("juan123"),
                pin_hash=hash_secret("4321"),  # PIN: 4321
                is_company_admin=False,
                create_uid=admin.id,
                write_uid=admin.id,
            )
            db.add(user)
            db.flush()
            employee.user_id = user.id
            print("Usuario 'juan' creado con PIN '4321'.")
        
        db.commit()
        print("Pre-registro completado con éxito. Listo para la prueba.")
    finally:
        db.close()

if __name__ == "__main__":
    create_test_setup()
