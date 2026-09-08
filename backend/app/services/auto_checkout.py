from datetime import datetime
from sqlalchemy.orm import Session

from app.models import HrEmployee, ResCompany, XAttendanceEventType, XAttendanceShift, XAutoCheckoutRule
from app.services.attendance_logic import AttendanceLogicService
from app.services.audit_log import AuditLogService
from app.services.schedules import should_auto_close_shift

MISSING_CHECKOUT_NOTE = "No marcó salida"


class AutoCheckoutService:
    def __init__(self, db: Session, company_id: int, user_id: int | None = None):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id

    def get_auto_checkout_rule(self, employee_id: int, branch_id: int | None = None) -> XAutoCheckoutRule | None:
        employee = self.db.get(HrEmployee, employee_id)
        rules = self.db.query(XAutoCheckoutRule).filter_by(company_id=self.company_id, active=True, auto_checkout_enabled=True).all()
        candidates = []
        for rule in rules:
            if rule.employee_id and rule.employee_id != employee_id:
                continue
            if rule.branch_id and rule.branch_id != (branch_id or (employee.branch_id if employee else None)):
                continue
            candidates.append(rule)
        def rank(rule: XAutoCheckoutRule) -> int:
            if rule.employee_id:
                return 0
            if rule.role_id:
                return 1
            if rule.branch_id:
                return 2
            return 3
        return sorted(candidates, key=lambda item: (rank(item), item.id))[0] if candidates else None

    def process_open_shifts(self, moment: datetime | None = None) -> list[int]:
        closed: list[int] = []
        shifts = self.db.query(XAttendanceShift).filter_by(company_id=self.company_id, state="open").all()
        close_type = self.db.query(XAttendanceEventType).filter_by(company_id=self.company_id, closes_shift=True, active=True).first()
        if not close_type:
            return closed
        for shift in shifts:
            employee = self.db.get(HrEmployee, shift.employee_id)
            if not employee:
                continue
            if not should_auto_close_shift(self.db, self.company_id, employee, shift.check_in_at, moment):
                continue
            self.auto_close_shift(shift.id, close_type.id, MISSING_CHECKOUT_NOTE)
            closed.append(shift.id)
        return closed

    def auto_close_shift(self, shift_id: int, event_type_id: int | None = None, note: str | None = None) -> None:
        shift = self.db.get(XAttendanceShift, shift_id)
        if not shift or shift.company_id != self.company_id or shift.state != "open":
            return
        close_type = self.db.get(XAttendanceEventType, event_type_id) if event_type_id else self.db.query(XAttendanceEventType).filter_by(company_id=self.company_id, closes_shift=True, active=True).first()
        if not close_type:
            return
        AttendanceLogicService(self.db, self.company_id, self.user_id).create_attendance_event(
            shift.employee_id,
            close_type.id,
            "auto",
            None,
            datetime.utcnow(),
            note or MISSING_CHECKOUT_NOTE,
            None,
            "auto_checkout",
        )
        AuditLogService(self.db, self.company_id).record(
            "auto_checkout",
            "x_attendance_shift",
            shift_id,
            user_id=self.user_id,
            employee_id=shift.employee_id,
            reason=note or MISSING_CHECKOUT_NOTE,
        )
        self.db.commit()


def process_all_companies(db: Session, moment: datetime | None = None) -> dict:
    closed: list[int] = []
    for company in db.query(ResCompany).all():
        closed.extend(AutoCheckoutService(db, company.id).process_open_shifts(moment))
    return {"closed_shift_ids": closed, "count": len(closed)}
