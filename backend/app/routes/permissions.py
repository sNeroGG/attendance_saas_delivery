from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import XPermission
from app.routes.common import require_company_admin
from app.schemas.core import PermissionOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.get("", response_model=list[PermissionOut])
def list_permissions(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    require_company_admin(_user)
    return db.query(XPermission).filter(XPermission.active.is_(True)).order_by(XPermission.category, XPermission.code).all()
