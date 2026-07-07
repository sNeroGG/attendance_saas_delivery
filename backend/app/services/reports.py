from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models import HrAttendance, XAssignmentValidation, XNoAttendanceNote, XAuditLog, XEmployeeAssignment


class ReportService:
    def __init__(self, db: Session, company_id: int):
        self.db = db
        self.company_id = company_id

    def hours(self) -> list[dict]:
        rows = self.db.query(HrAttendance.employee_id, func.count(HrAttendance.id), func.sum(HrAttendance.worked_hours)).filter_by(company_id=self.company_id).group_by(HrAttendance.employee_id).all()
        return [{"employee_id": r[0], "records": int(r[1] or 0), "worked_hours": float(r[2] or 0)} for r in rows]

    def assignments(self) -> list[dict]:
        rows = self.db.query(XEmployeeAssignment.state, func.count(XEmployeeAssignment.id)).filter_by(company_id=self.company_id).group_by(XEmployeeAssignment.state).all()
        return [{"state": r[0], "count": int(r[1])} for r in rows]

    def attendance_exceptions(self) -> list[dict]:
        rows = self.db.query(XNoAttendanceNote.reason, func.count(XNoAttendanceNote.id)).filter_by(company_id=self.company_id).group_by(XNoAttendanceNote.reason).all()
        return [{"reason": r[0], "count": int(r[1])} for r in rows]



    def audit(self) -> list[dict]:
        rows = self.db.query(XAuditLog.action, func.count(XAuditLog.id)).filter_by(company_id=self.company_id).group_by(XAuditLog.action).all()
        return [{"action": r[0], "count": int(r[1])} for r in rows]
