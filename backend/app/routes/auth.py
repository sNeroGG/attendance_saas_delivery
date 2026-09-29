from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser
from app.schemas.core import LoginRequest, TokenResponse
from app.security.auth import create_access_token, get_current_user, verify_secret
from app.security.rate_limit import check_rate_limit, clear_rate_limit

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
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"login:{payload.login.strip().casefold()}:{client_ip}"
    if not check_rate_limit(rate_key, min_interval_seconds=2):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta de nuevo más tarde.")
    user = db.query(ResUser).filter(ResUser.login == payload.login).first()
    if not user or not verify_secret(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid login or password")
    user.last_login = datetime.utcnow()
    db.commit()
    clear_rate_limit(rate_key)
    return TokenResponse(access_token=create_access_token(user), user=user_payload(user))


@router.post("/logout")
def logout() -> dict:
    return {"ok": True}


@router.get("/me")
def me(current_user: ResUser = Depends(get_current_user)) -> dict:
    return user_payload(current_user)
