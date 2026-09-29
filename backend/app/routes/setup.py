"""One-time company setup for the first authenticated administrator."""

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HrEmployee, ResCompany, ResUser, XBranch, XDevice
from app.routes.common import require_company_admin
from app.schemas.core import FirstRunSetupIn
from app.security.auth import get_current_user, hash_secret
from app.services.employee_defaults import apply_employee_defaults

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/status")
def setup_status(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    has_employees = db.query(HrEmployee.id).filter_by(company_id=user.company_id, active=True).first() is not None
    return {"needs_setup": not has_employees}


@router.post("/first-run")
def first_run_setup(payload: FirstRunSetupIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    require_company_admin(user)
    branch_name = payload.branch_name.strip()
    device_name = payload.device_name.strip()
    employee_names = [entry.name.strip() for entry in payload.employees]
    if len(branch_name) < 2 or len(device_name) < 2 or any(len(name) < 2 for name in employee_names):
        raise HTTPException(status_code=422, detail="Completa la sucursal, el dispositivo y los nombres de empleados.")
    if len({name.casefold() for name in employee_names}) != len(employee_names):
        raise HTTPException(status_code=422, detail="No repitas el nombre de un empleado.")

    try:
        company = db.query(ResCompany).filter_by(id=user.company_id).with_for_update().first()
        if not company:
            raise HTTPException(status_code=404, detail="No se encontró la empresa.")
        if db.query(HrEmployee.id).filter_by(company_id=user.company_id, active=True).first():
            raise HTTPException(status_code=409, detail="La configuración inicial ya no está disponible porque la empresa ya tiene empleados.")

        branch = db.query(XBranch).filter_by(company_id=user.company_id, active=True).order_by(XBranch.id).first()
        if branch is None:
            branch = XBranch(
                company_id=user.company_id,
                name=branch_name,
                timezone="America/Guatemala",
                create_uid=user.id,
                write_uid=user.id,
            )
            db.add(branch)
            db.flush()
        else:
            branch.name = branch_name
            branch.timezone = "America/Guatemala"
            branch.write_uid = user.id

        device = db.query(XDevice).filter_by(company_id=user.company_id, active=True).order_by(XDevice.id).first()
        if device:
            device.branch_id = branch.id
            device.name = device_name
            device.device_lock_enabled = False
            device.write_uid = user.id
        else:
            used_device_codes = {row.device_code for row in db.query(XDevice.device_code).all()}
            device_code = next((f"KIOSK-{number:02d}" for number in range(1, 1000) if f"KIOSK-{number:02d}" not in used_device_codes), None)
            if not device_code:
                raise HTTPException(status_code=409, detail="No hay un código de kiosko disponible.")
            device = XDevice(
                company_id=user.company_id,
                branch_id=branch.id,
                name=device_name,
                device_code=device_code,
                device_type="kiosk",
                session_timeout=company.kiosk_session_timeout if company else 30,
                # This is a shared kiosk, so it must not bind to the first employee.
                device_lock_enabled=False,
                create_uid=user.id,
                write_uid=user.id,
            )
            db.add(device)
            db.flush()

        credentials = []
        used_pins: set[str] = set()
        for name in employee_names:
            pin = f"{secrets.randbelow(9000) + 1000:04d}"
            while pin in used_pins:
                pin = f"{secrets.randbelow(9000) + 1000:04d}"
            used_pins.add(pin)

            values = apply_employee_defaults(
                db,
                user.company_id,
                user.id,
                {"name": name, "branch_id": branch.id, "create_user_profile": True},
            )
            values.pop("user_login", None)
            values.pop("create_user_profile", None)
            values.pop("task_template_ids", None)
            employee = HrEmployee(
                **values,
                company_id=user.company_id,
                create_uid=user.id,
                write_uid=user.id,
            )
            db.add(employee)
            db.flush()

            login = employee.employee_code
            if db.query(ResUser.id).filter_by(login=login).first():
                login = f"{login}-{user.company_id}"
            employee_user = ResUser(
                company_id=user.company_id,
                employee_id=employee.id,
                name=name,
                login=login,
                password_hash=hash_secret(secrets.token_urlsafe(32)),
                pin_hash=hash_secret(pin),
                create_uid=user.id,
                write_uid=user.id,
            )
            db.add(employee_user)
            db.flush()
            employee.user_id = employee_user.id
            credentials.append({
                "name": name,
                "employee_code": employee.employee_code,
                "login": login,
                "pin": pin,
            })

        db.commit()
        return {
            "branch": {"id": branch.id, "name": branch.name},
            "device": {"id": device.id, "name": device.name, "device_code": device.device_code},
            "employees": credentials,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
