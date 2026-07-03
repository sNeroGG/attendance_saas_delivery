import hashlib
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import HrEmployee, XDevice, XFaceTemplate
from app.services.audit_log import AuditLogService
from app.services.biometric_log import BiometricLogService


class FaceRecognitionService:
    provider = "mock"

    def __init__(self, db: Session, company_id: int, user_id: int | None = None):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id

    def _encoding(self, image_base64: str) -> str:
        return hashlib.sha256(image_base64.encode("utf-8")).hexdigest()

    def register_face(self, employee_id: int, image_base64: str) -> XFaceTemplate:
        employee = self.db.get(HrEmployee, employee_id)
        if not employee or employee.company_id != self.company_id:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")
        current = self.db.query(XFaceTemplate).filter_by(company_id=self.company_id, employee_id=employee_id, active=True).first()
        if current:
            current.active = False
            current.write_uid = self.user_id
        template = XFaceTemplate(company_id=self.company_id, employee_id=employee_id, face_encoding=self._encoding(image_base64), provider=self.provider, confidence_threshold=0.75, create_uid=self.user_id, write_uid=self.user_id)
        self.db.add(template)
        self.db.flush()
        AuditLogService(self.db, self.company_id).record("register_face", "x_face_template", template.id, user_id=self.user_id, employee_id=employee_id, new_value="provider=mock")
        self.db.commit()
        self.db.refresh(template)
        return template

    def identify_face(self, image_base64: str, device_code: str | None = None, ip_address: str | None = None) -> tuple[HrEmployee | None, float]:
        device = self.db.query(XDevice).filter_by(device_code=device_code).first() if device_code else None
        templates = self.db.query(XFaceTemplate).filter_by(company_id=self.company_id, active=True).order_by(XFaceTemplate.id).all()
        if not templates:
            BiometricLogService(self.db, self.company_id).record("identify", "face_id", False, device_id=device.id if device else None, confidence_score=0, failure_reason="Sin plantillas", ip_address=ip_address)
            self.db.commit()
            return None, 0.0
        incoming = self._encoding(image_base64)
        exact = next((item for item in templates if item.face_encoding == incoming), None)
        template = exact or templates[0]
        confidence = 0.99 if exact else 0.82
        employee = self.db.get(HrEmployee, template.employee_id)
        success = bool(employee and confidence >= template.confidence_threshold)
        BiometricLogService(self.db, self.company_id).record("identify", "face_id", success, employee_id=employee.id if success and employee else None, device_id=device.id if device else None, confidence_score=confidence, failure_reason=None if success else "Confianza insuficiente", ip_address=ip_address)
        self.db.commit()
        return (employee if success else None), confidence

    def compare_face(self, image_base64: str, employee_id: int, device_code: str | None = None, ip_address: str | None = None) -> bool:
        template = self.db.query(XFaceTemplate).filter_by(company_id=self.company_id, employee_id=employee_id, active=True).first()
        if not template:
            BiometricLogService(self.db, self.company_id).record("compare", "face_id", False, employee_id=employee_id, failure_reason="Sin plantilla", ip_address=ip_address)
            self.db.commit()
            return False
        confidence = 0.99 if template.face_encoding == self._encoding(image_base64) else 0.80
        success = confidence >= template.confidence_threshold
        BiometricLogService(self.db, self.company_id).record("compare", "face_id", success, employee_id=employee_id, confidence_score=confidence, failure_reason=None if success else "Confianza insuficiente", ip_address=ip_address)
        self.db.commit()
        return success

    def disable_face_template(self, employee_id: int) -> None:
        templates = self.db.query(XFaceTemplate).filter_by(company_id=self.company_id, employee_id=employee_id, active=True).all()
        for template in templates:
            template.active = False
            template.write_uid = self.user_id
            AuditLogService(self.db, self.company_id).record("disable_face", "x_face_template", template.id, user_id=self.user_id, employee_id=employee_id)
        self.db.commit()
