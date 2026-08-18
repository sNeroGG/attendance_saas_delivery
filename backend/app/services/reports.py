from datetime import timedelta
from sqlalchemy.orm import Session

from app.models import (
    HrAttendance,
    HrEmployee,
    XAssignmentTemplate,
    XAttendanceShift,
    XAuditLog,
    XBiometricLog,
    XEmployeeAssignment,
    XNoAttendanceNote,
)
from app.services.operational_day import (
    COMPLETED_TASK_STATES,
    SHIFT_LABEL,
    evaluate_compliance,
    window_contains,
)
from app.services.schedules import company_default_window, describe_employee_work, resolve_employee_schedule, window_for_date


class ReportService:
    def __init__(self, db: Session, company_id: int):
        self.db = db
        self.company_id = company_id

    def hours(self) -> list[dict]:
        from sqlalchemy import func
        rows = self.db.query(HrAttendance.employee_id, func.count(HrAttendance.id), func.sum(HrAttendance.worked_hours)).filter_by(company_id=self.company_id).group_by(HrAttendance.employee_id).all()
        return [{"employee_id": r[0], "records": int(r[1] or 0), "worked_hours": float(r[2] or 0)} for r in rows]

    def assignments(self) -> list[dict]:
        from sqlalchemy import func
        rows = self.db.query(XEmployeeAssignment.state, func.count(XEmployeeAssignment.id)).filter_by(company_id=self.company_id).group_by(XEmployeeAssignment.state).all()
        return [{"state": r[0], "count": int(r[1])} for r in rows]

    def attendance_exceptions(self) -> list[dict]:
        from sqlalchemy import func
        rows = self.db.query(XNoAttendanceNote.reason, func.count(XNoAttendanceNote.id)).filter_by(company_id=self.company_id).group_by(XNoAttendanceNote.reason).all()
        return [{"reason": r[0], "count": int(r[1])} for r in rows]

    def biometric(self) -> list[dict]:
        from sqlalchemy import func
        rows = self.db.query(XBiometricLog.method, XBiometricLog.success, func.count(XBiometricLog.id)).filter_by(company_id=self.company_id).group_by(XBiometricLog.method, XBiometricLog.success).all()
        return [{"method": r[0], "success": bool(r[1]), "count": int(r[2])} for r in rows]

    def audit(self) -> list[dict]:
        from sqlalchemy import func
        rows = self.db.query(XAuditLog.action, func.count(XAuditLog.id)).filter_by(company_id=self.company_id).group_by(XAuditLog.action).all()
        return [{"action": r[0], "count": int(r[1])} for r in rows]

    def daily(self, employee_id: int | None = None) -> dict:
        company_window = company_default_window(self.db, self.company_id)
        start, end = company_window.get("start"), company_window.get("end")
        report_date = company_window.get("report_date")
        employees_query = self.db.query(HrEmployee).filter_by(company_id=self.company_id, active=True, is_active_for_work=True)
        if employee_id:
            employees_query = employees_query.filter(HrEmployee.id == employee_id)
        employees = employees_query.order_by(HrEmployee.name).all()

        shifts = (
            self.db.query(XAttendanceShift)
            .filter(XAttendanceShift.company_id == self.company_id)
            .all()
        )
        shifts_by_employee: dict[int, list[XAttendanceShift]] = {}
        for shift in shifts:
            shifts_by_employee.setdefault(shift.employee_id, []).append(shift)

        assignments = (
            self.db.query(XEmployeeAssignment)
            .filter(XEmployeeAssignment.company_id == self.company_id)
            .all()
        )
        templates = {item.id: item.name for item in self.db.query(XAssignmentTemplate).filter_by(company_id=self.company_id).all()}

        from app.services.operational_day import operational_window
        if start is None or end is None:
            start, end = operational_window()

        rows = []
        for employee in employees:
            schedule, _ = resolve_employee_schedule(self.db, self.company_id, employee)
            if report_date:
                emp_window = window_for_date(self.db, schedule, report_date)
            else:
                emp_window = describe_employee_work(self.db, self.company_id, employee)
            emp_start = emp_window.get("start") or start
            emp_end = emp_window.get("end") or end
            is_off = bool(emp_window.get("is_off"))
            emp_shifts = [
                item for item in shifts_by_employee.get(employee.id, [])
                if emp_start and emp_end and emp_start <= item.check_in_at < emp_end
            ]
            emp_shifts = sorted(emp_shifts, key=lambda item: item.check_in_at)
            current_shift = emp_shifts[-1] if emp_shifts else None
            checked_in = current_shift is not None
            late = False
            if checked_in and current_shift and emp_window.get("start"):
                late = current_shift.check_in_at > emp_window["start"] + timedelta(minutes=10)

            emp_assignments = [
                item for item in assignments
                if item.employee_id == employee.id and (
                    (item.assigned_at and emp_start and emp_end and window_contains(item.assigned_at, emp_start, emp_end))
                    or (item.shift_id and current_shift and item.shift_id == current_shift.id)
                    or (item.required and item.state not in COMPLETED_TASK_STATES)
                )
            ]
            seen = set()
            unique_assignments = []
            for item in emp_assignments:
                if item.id in seen:
                    continue
                seen.add(item.id)
                unique_assignments.append(item)

            required = [item for item in unique_assignments if item.required]
            pending = [item for item in required if item.state not in COMPLETED_TASK_STATES]
            completed = [item for item in unique_assignments if item.state in {"completed", "validated"}]
            compliance = evaluate_compliance(checked_in, len(pending), is_off=is_off, late=late)

            rows.append({
                "employee_id": employee.id,
                "name": employee.name,
                "employee_code": employee.employee_code,
                "job_title": employee.job_title,
                "checked_in": checked_in,
                "check_in_at": current_shift.check_in_at if current_shift else None,
                "check_out_at": current_shift.check_out_at if current_shift else None,
                "shift_state": "off" if is_off and not checked_in else (current_shift.state if current_shift else "absent"),
                "schedule_label": emp_window.get("label"),
                "is_off": is_off,
                "late": late,
                "tasks_assigned": len(unique_assignments),
                "tasks_completed": len(completed),
                "tasks_pending": len(pending),
                "pending_task_names": [templates.get(item.template_id, f"#{item.template_id}") for item in pending],
                "compliant": compliance["compliant"],
                "issues": compliance["issues"],
            })

        summary = {
            "total_employees": len(rows),
            "checked_in": sum(1 for row in rows if row["checked_in"]),
            "missing_checkin": sum(1 for row in rows if not row["checked_in"] and not row.get("is_off")),
            "tasks_incomplete": sum(1 for row in rows if row["tasks_pending"] > 0),
            "compliant": sum(1 for row in rows if row["compliant"]),
            "non_compliant": sum(1 for row in rows if not row["compliant"]),
        }
        return {
            "operational_day": {
                "start": start,
                "end": end,
                "shift_window": company_window.get("label") or SHIFT_LABEL,
            },
            "summary": summary,
            "employees": rows,
        }

    def dashboard(self) -> dict:
        daily = self.daily()
        open_shifts = (
            self.db.query(XAttendanceShift)
            .filter_by(company_id=self.company_id, state="open")
            .all()
        )
        pending_validation = (
            self.db.query(XEmployeeAssignment)
            .filter_by(company_id=self.company_id, state="validation_pending")
            .count()
        )
        active_employees = []
        for shift in open_shifts:
            employee = self.db.get(HrEmployee, shift.employee_id)
            active_employees.append({
                "employee_id": shift.employee_id,
                "name": employee.name if employee else f"Empleado #{shift.employee_id}",
                "check_in_at": shift.check_in_at,
                "shift_id": shift.id,
            })
        return {
            **daily,
            "active_now": active_employees,
            "pending_validation": pending_validation,
        }
