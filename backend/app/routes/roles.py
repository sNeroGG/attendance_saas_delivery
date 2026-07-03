from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser, XRole, XRolePermission
from app.routes.common import apply_values, company_query, get_company_record, to_dict
from app.schemas.core import AssignPermissionRequest, RoleIn, RoleOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XRole, user).order_by(XRole.name).all()


@router.post("", response_model=RoleOut)
def create_role(payload: RoleIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = XRole(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=RoleOut)
def get_role(record_id: int, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return get_company_record(db, XRole, record_id, user)


@router.put("/{record_id}", response_model=RoleOut)
def update_role(record_id: int, payload: RoleIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = get_company_record(db, XRole, record_id, user)
    apply_values(record, to_dict(payload), user.id)
    db.commit()
    db.refresh(record)
    return record


@router.post("/{record_id}/permissions")
def set_role_permissions(record_id: int, payload: AssignPermissionRequest, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    role = get_company_record(db, XRole, record_id, user)
    db.query(XRolePermission).filter(XRolePermission.role_id == role.id).delete()
    for permission_id in payload.permission_ids:
        db.add(XRolePermission(role_id=role.id, permission_id=permission_id, create_uid=user.id))
    db.commit()
    return {"ok": True, "permission_ids": payload.permission_ids}
