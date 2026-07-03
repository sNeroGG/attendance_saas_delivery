from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser
from app.schemas.core import LoginRequest, TokenResponse
from app.security.auth import create_access_token, get_current_user, verify_secret

router = APIRouter(prefix="/auth", tags=["auth"])


def user_payload(user: ResUser) -> dict:
    return {
        "id": user.id,
        "company_id": user.company_id,
        "name": user.name,
        "login": user.login,
        "email": user.email,
        "is_superadmin": user.is_superadmin,
        "is_company_admin": user.is_company_admin,
    }


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(ResUser).filter(ResUser.login == payload.login).first()
    if not user or not verify_secret(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid login or password")
    user.last_login = datetime.utcnow()
    db.commit()
    return TokenResponse(access_token=create_access_token(user), user=user_payload(user))


@router.post("/logout")
def logout() -> dict:
    return {"ok": True}


@router.get("/me")
def me(current_user: ResUser = Depends(get_current_user)) -> dict:
    return user_payload(current_user)
