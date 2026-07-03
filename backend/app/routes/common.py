from typing import Any, TypeVar
from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models import ResUser

ModelT = TypeVar("ModelT")


def company_query(db: Session, model: type[ModelT], user: ResUser):
    return db.query(model).filter(model.company_id == user.company_id)


def get_company_record(db: Session, model: type[ModelT], record_id: int, user: ResUser) -> ModelT:
    record = company_query(db, model, user).filter(model.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


def apply_values(record: Any, values: dict[str, Any], user_id: int | None = None) -> Any:
    for key, value in values.items():
        if value is not None and hasattr(record, key):
            setattr(record, key, value)
    if user_id is not None and hasattr(record, "write_uid"):
        record.write_uid = user_id
    return record


def to_dict(model: BaseModel, exclude: set[str] | None = None) -> dict[str, Any]:
    return model.model_dump(exclude_unset=True, exclude=exclude or set())
