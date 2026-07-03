from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import ResUser, XEmployeeRole, XPermission, XRolePermission
from app.security.auth import verify_secret


class SupervisorValidationService:
    def __init__(self, db: Session, company_id: int):
        self.db = db
        self.company_id = company_id

    def validate_supervisor_pin(self, supervisor_pin: str) -> ResUser:
        users = self.db.query(ResUser).filter_by(company_id=self.company_id, active=True).all()
        for user in users:
            if verify_secret(supervisor_pin, user.pin_hash):
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
