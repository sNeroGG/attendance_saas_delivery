from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResCompany, ResUser
from app.routes.common import apply_values, to_dict
from app.schemas.core import CompanyBase, CompanyOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/current", response_model=CompanyOut)
def current_company(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return db.get(ResCompany, user.company_id)


@router.put("/current", response_model=CompanyOut)
def update_current_company(payload: CompanyBase, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    company = db.get(ResCompany, user.company_id)
    apply_values(company, to_dict(payload), user.id)
    db.commit()
    db.refresh(company)
    return company
