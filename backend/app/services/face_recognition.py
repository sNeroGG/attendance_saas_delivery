import os
import sys
import base64
import urllib.request
import hashlib
from fastapi import HTTPException
from sqlalchemy.orm import Session
import cv2
import numpy as np

from app.models import HrEmployee, XDevice, XFaceTemplate
from app.services.audit_log import AuditLogService
from app.services.biometric_log import BiometricLogService

BASE_DIR = "/app"
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

YUNET_MODEL = os.path.join(BASE_DIR, "face_detection_yunet_2023mar.onnx")
SFACE_MODEL = os.path.join(BASE_DIR, "face_recognition_sface_2021dec.onnx")

def download_models():
    """Descarga los modelos ONNX en /app si no existen."""
    for model_name, url in [(YUNET_MODEL, YUNET_URL), (SFACE_MODEL, SFACE_URL)]:
        if not os.path.exists(model_name):
            try:
                print(f"Descargando {model_name} de OpenCV Zoo para el backend...")
                urllib.request.urlretrieve(url, model_name)
            except Exception as e:
                print(f"[!] Error al descargar modelo {model_name}: {e}")

class FaceRecognitionService:
    provider = "opencv"

    def __init__(self, db: Session, company_id: int, user_id: int | None = None):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id
        download_models()

    def _base64_to_cv2(self, image_base64: str) -> np.ndarray | None:
        try:
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            img_data = base64.b64decode(image_base64)
            nparr = np.frombuffer(img_data, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"[!] Error al decodificar base64: {e}")
            return None

    def _get_face_feature(self, img: np.ndarray) -> np.ndarray | None:
        """Detecta el rostro, lo alinea y extrae el vector de características de SFace."""
        try:
            if img is None:
                return None
            h, w, _ = img.shape
            
            # Inicializar YuNet y SFace
            detector = cv2.FaceDetectorYN.create(YUNET_MODEL, "", (w, h))
            recognizer = cv2.FaceRecognizerSF.create(SFACE_MODEL, "")
            
            _, faces = detector.detect(img)
            if faces is None or len(faces) == 0:
                return None
                
            # Alinear y extraer características del primer rostro
            face_aligned = recognizer.alignCrop(img, faces[0])
            return recognizer.feature(face_aligned)
        except Exception as e:
            print(f"[!] Error en extracción de características en servidor: {e}")
            return None

    def register_face(self, employee_id: int, images: list[str]) -> list[XFaceTemplate]:
        employee = self.db.get(HrEmployee, employee_id)
        if not employee or employee.company_id != self.company_id:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")
            
        # Desactivar TODAS las plantillas anteriores de este empleado
        self.db.query(XFaceTemplate).filter_by(company_id=self.company_id, employee_id=employee_id, active=True).update({"active": False})
        
        templates = []
        for i, image_base64 in enumerate(images):
            # Validar que la imagen enviada tenga un rostro detectable
            img = self._base64_to_cv2(image_base64)
            if img is None:
                raise HTTPException(status_code=400, detail=f"Imagen {i+1} inválida o corrupta")
                
            feature = self._get_face_feature(img)
            if feature is None:
                angle_name = "Frente" if i == 0 else "Izquierda" if i == 1 else "Derecha"
                raise HTTPException(
                    status_code=400, 
                    detail=f"La cámara no detectó ningún rostro de forma nítida en la posición: {angle_name}. Por favor, ponte de frente/perfil con buena luz e inténtalo de nuevo."
                )

            template = XFaceTemplate(
                company_id=self.company_id,
                employee_id=employee_id,
                face_encoding=image_base64,
                provider=self.provider,
                confidence_threshold=0.40, # Umbral de similitud de coseno para SFace (alto es más estricto)
                create_uid=self.user_id,
                write_uid=self.user_id
            )
            self.db.add(template)
            templates.append(template)
            
        self.db.flush()
        
        for t in templates:
            AuditLogService(self.db, self.company_id).record(
                "register_face", "x_face_template", t.id, 
                user_id=self.user_id, employee_id=employee_id, new_value="provider=opencv_multi"
            )
            
        self.db.commit()
        return templates

    def identify_face(self, image_base64: str, device_code: str | None = None, ip_address: str | None = None) -> tuple[HrEmployee | None, float]:
        device = self.db.query(XDevice).filter_by(device_code=device_code).first() if device_code else None
        templates = self.db.query(XFaceTemplate).filter_by(company_id=self.company_id, active=True).order_by(XFaceTemplate.id).all()
        
        if not templates:
            BiometricLogService(self.db, self.company_id).record(
                "identify", "face_id", False, 
                device_id=device.id if device else None, 
                confidence_score=0, failure_reason="Sin plantillas", ip_address=ip_address
            )
            self.db.commit()
            return None, 0.0

        # 1. Obtener características de la foto entrante
        incoming_img = self._base64_to_cv2(image_base64)
        incoming_feature = self._get_face_feature(incoming_img)
        
        if incoming_feature is None:
            BiometricLogService(self.db, self.company_id).record(
                "identify", "face_id", False, 
                device_id=device.id if device else None, 
                confidence_score=0, failure_reason="Rostro no detectado por la cámara", ip_address=ip_address
            )
            self.db.commit()
            return None, 0.0

        best_employee = None
        best_confidence = 0.0
        best_score = -1.0
        COSINE_THRESHOLD = 0.40

        # Inicializar recognizer de forma rápida para comparar
        recognizer = cv2.FaceRecognizerSF.create(SFACE_MODEL, "")

        # 2. Comparar contra todas las plantillas activas de la base de datos
        for temp in templates:
            ref_img = self._base64_to_cv2(temp.face_encoding)
            ref_feature = self._get_face_feature(ref_img)
            if ref_feature is None:
                continue

            # Obtener similitud de coseno real (OpenCV match con FR_COSINE retorna similitud de -1 a 1)
            try:
                score = recognizer.match(ref_feature, incoming_feature, cv2.FaceRecognizerSF_FR_COSINE)
                if score > best_score:
                    best_score = score
                    best_employee = self.db.get(HrEmployee, temp.employee_id)
                    best_confidence = max(0.0, min(1.0, score))
            except Exception as e:
                print(f"[!] Error al comparar rostro: {e}")
                continue

        # Si la similitud de coseno es mayor o igual al umbral, es exitoso
        success = bool(best_employee and best_score >= COSINE_THRESHOLD)
        
        BiometricLogService(self.db, self.company_id).record(
            "identify", "face_id", success, 
            employee_id=best_employee.id if success and best_employee else None, 
            device_id=device.id if device else None, 
            confidence_score=best_confidence, 
            failure_reason=None if success else f"Confianza insuficiente (Sim: {best_score:.3f})", 
            ip_address=ip_address
        )
        self.db.commit()
        return (best_employee if success else None), best_confidence

    def compare_face(self, image_base64: str, employee_id: int, device_code: str | None = None, ip_address: str | None = None) -> bool:
        template = self.db.query(XFaceTemplate).filter_by(company_id=self.company_id, employee_id=employee_id, active=True).first()
        if not template:
            BiometricLogService(self.db, self.company_id).record(
                "compare", "face_id", False, 
                employee_id=employee_id, failure_reason="Sin plantilla", ip_address=ip_address
            )
            self.db.commit()
            return False

        # Obtener características de la foto de base de datos
        ref_img = self._base64_to_cv2(template.face_encoding)
        ref_feature = self._get_face_feature(ref_img)

        # Obtener características de la foto entrante
        incoming_img = self._base64_to_cv2(image_base64)
        incoming_feature = self._get_face_feature(incoming_img)

        if ref_feature is None or incoming_feature is None:
            BiometricLogService(self.db, self.company_id).record(
                "compare", "face_id", False, 
                employee_id=employee_id, failure_reason="Rostro no detectable en cámara", ip_address=ip_address
            )
            self.db.commit()
            return False

        # Comparación real
        COSINE_THRESHOLD = 0.40
        try:
            recognizer = cv2.FaceRecognizerSF.create(SFACE_MODEL, "")
            score = recognizer.match(ref_feature, incoming_feature, cv2.FaceRecognizerSF_FR_COSINE)
            success = score >= COSINE_THRESHOLD
            confidence = max(0.0, min(1.0, score))
        except Exception as e:
            print(f"[!] Error en comparación real: {e}")
            success = False
            confidence = 0.0
            score = -1.0

        BiometricLogService(self.db, self.company_id).record(
            "compare", "face_id", success, 
            employee_id=employee_id, 
            confidence_score=confidence,
            failure_reason=None if success else f"No coincide (Sim: {score:.3f})", 
            ip_address=ip_address
        )
        self.db.commit()
        return success
