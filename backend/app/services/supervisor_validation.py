from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import ResUser, XEmployeeRole, XPermission, XRolePermission
from app.security.auth import verify_secret


class SupervisorValidationService:
    def __init__(self, db: Session, company_id: int):
        self.db = db
        self.company_id = company_id

    def validate_supervisor_pin(self, supervisor_pin: str) -> ResUser:
        from app.models import XManagerTemporaryPin
        from datetime import datetime
        
        # 1. Search for active, unused, unexpired temporary manager PIN
        temp_pin = self.db.query(XManagerTemporaryPin).filter(
            XManagerTemporaryPin.company_id == self.company_id,
            XManagerTemporaryPin.pin == supervisor_pin,
            XManagerTemporaryPin.used_at.is_(None),
            XManagerTemporaryPin.expires_at > datetime.utcnow()
        ).first()

        if temp_pin:
            # Mark as used immediately (single-use)
            temp_pin.used_at = datetime.utcnow()
            self.db.add(temp_pin)

            # Record in audit log
            from app.services.audit_log import AuditLogService
            AuditLogService(self.db, self.company_id).record(
                action="use_temporary_pin",
                model_name="x_manager_temporary_pin",
                record_id=temp_pin.id,
                user_id=temp_pin.created_by_user_id,
                reason="PIN temporal de gerente utilizado"
            )
            
            self.db.commit()

            # Return the user who generated it
            creator = self.db.get(ResUser, temp_pin.created_by_user_id)
            if creator and creator.active:
                return creator
            raise HTTPException(status_code=401, detail="El creador del PIN temporal no está activo")

        # 2. Fallback to standard supervisor PIN validation
        users = self.db.query(ResUser).filter_by(company_id=self.company_id, active=True).all()
        for user in users:
            if user.pin_hash and verify_secret(supervisor_pin, user.pin_hash):
                return user
        raise HTTPException(status_code=401, detail="PIN de supervisor invalido")

    def check_supervisor_permission(self, supervisor: ResUser, permission_code: str) -> None:
        if supervisor.is_superadmin or supervisor.is_company_admin:
            return
        if not supervisor.employee_id:
            raise HTTPException(status_code=403, detail="Supervisor sin empleado vinculado")
        role_ids = [row.role_id for row in self.db.query(XEmployeeRole).filter_by(employee_id=supervisor.employee_id).all()]
        permission = self.db.query(XPermission).filter_by(code=permission_code, active=True).first()
        if not permission:
            raise HTTPException(status_code=403, detail="Permiso no configurado")
        exists = self.db.query(XRolePermission).filter(XRolePermission.role_id.in_(role_ids), XRolePermission.permission_id == permission.id).first()
        if not exists:
            raise HTTPException(status_code=403, detail="Supervisor sin permiso requerido")
