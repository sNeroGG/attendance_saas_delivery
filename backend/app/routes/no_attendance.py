from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ResUser, XNoAttendanceNote
from app.routes.common import company_query
from app.schemas.attendance import NoAttendanceNoteIn, NoAttendanceNoteOut
from app.security.auth import get_current_user

router = APIRouter(prefix="/no-attendance", tags=["no-attendance"])


@router.get("", response_model=list[NoAttendanceNoteOut])
def list_notes(db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    return company_query(db, XNoAttendanceNote, user).order_by(XNoAttendanceNote.date.desc(), XNoAttendanceNote.id.desc()).all()


@router.post("", response_model=NoAttendanceNoteOut)
def create_note(payload: NoAttendanceNoteIn, db: Session = Depends(get_db), user: ResUser = Depends(get_current_user)):
    record = XNoAttendanceNote(**payload.model_dump(), company_id=user.company_id, create_uid=user.id, write_uid=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
