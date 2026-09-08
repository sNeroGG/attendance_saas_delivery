from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models import (
    HrEmployee,
    XAttendanceEvent,
    XAttendanceEventType,
    XAttendanceShift,
    XNoAttendanceNote,
)
from app.services.operational_day import (
    ABSENT_LABEL,
    EXCUSED_REASONS,
    ISSUES_LABEL,
    LATE_LABEL,
    MISSING_CHECKOUT_LABEL,
    OK_LABEL,
    PERMISSION_LABEL,
    as_local,
    as_utc,
    classify_employee_day,
)
from app.services.schedules import resolve_employee_schedule, window_for_date


class DayBoardService:
    def __init__(self, db: Session, company_id: int):
        self.db = db
        self.company_id = company_id

    def _employees(self) -> list[HrEmployee]:
        return (
            self.db.query(HrEmployee)
            .filter_by(company_id=self.company_id, active=True, is_active_for_work=True)
            .order_by(HrEmployee.name)
            .all()
        )

    def _notes_by_employee(self, day: date) -> dict[int, XNoAttendanceNote]:
        notes = (
            self.db.query(XNoAttendanceNote)
            .filter(
                XNoAttendanceNote.company_id == self.company_id,
                XNoAttendanceNote.date == day,
                XNoAttendanceNote.state.in_(("approved", "done", "draft")),
            )
            .all()
        )
        by_emp: dict[int, XNoAttendanceNote] = {}
        for note in notes:
            if (note.reason or "").lower() in EXCUSED_REASONS:
                by_emp[note.employee_id] = note
        return by_emp

    def _shifts_for_window(self, employee_id: int, day: date, start: datetime | None, end: datetime | None) -> list[XAttendanceShift]:
        shifts = self.db.query(XAttendanceShift).filter_by(company_id=self.company_id, employee_id=employee_id).all()
        if start and end:
            return [item for item in shifts if start <= item.check_in_at < end]
        return [item for item in shifts if as_local(item.check_in_at).date() == day]

    def employee_row(
        self,
        employee: HrEmployee,
        day: date,
        now: datetime | None = None,
        notes: dict[int, XNoAttendanceNote] | None = None,
    ) -> dict:
        moment = now or as_utc()
        today = as_local(moment).date()
        schedule, _ = resolve_employee_schedule(self.db, self.company_id, employee)
        window = window_for_date(self.db, schedule, day)
        notes = notes if notes is not None else self._notes_by_employee(day)
        excused = employee.id in notes
        shifts = self._shifts_for_window(employee.id, day, window.get("start"), window.get("end"))
        shift = sorted(shifts, key=lambda item: item.check_in_at)[-1] if shifts else None
        late = False
        if shift and window.get("start"):
            late = shift.check_in_at > window["start"] + timedelta(minutes=10)
        classified = classify_employee_day(
            day=day,
            today=today,
            now=moment,
            is_off=bool(window.get("is_off")),
            excused=excused,
            checked_in=shift is not None,
            checked_out=bool(shift and shift.check_out_at),
            auto_closed=bool(shift and shift.auto_closed),
            late=late,
            window_start=window.get("start"),
            window_end=window.get("end"),
        )
        note = notes.get(employee.id)
        return {
            "employee_id": employee.id,
            "name": employee.name,
            "employee_code": employee.employee_code,
            "job_title": employee.job_title,
            "is_off": bool(window.get("is_off")),
            "schedule_label": window.get("label"),
            "checked_in": shift is not None,
            "checked_out": bool(shift and shift.check_out_at),
            "check_in_at": shift.check_in_at if shift else None,
            "check_out_at": shift.check_out_at if shift else None,
            "shift_state": shift.state if shift else ("off" if window.get("is_off") else "absent"),
            "auto_closed": bool(shift and shift.auto_closed),
            "late": late,
            "permission_id": note.id if note else None,
            **classified,
        }

    def day_summary(self, day: date, now: datetime | None = None) -> dict:
        notes = self._notes_by_employee(day)
        rows = [self.employee_row(employee, day, now, notes) for employee in self._employees()]
        expected = [row for row in rows if not row["is_off"]]
        issues = [row for row in expected if row["has_issue"]]
        has_issue = len(issues) > 0
        return {
            "date": day.isoformat(),
            "weekday": day.weekday(),
            "status": "issues" if has_issue else "ok",
            "status_label": ISSUES_LABEL if has_issue else OK_LABEL,
            "issue_count": len(issues),
            "present": sum(1 for row in expected if row["checked_in"]),
            "absent": sum(1 for row in expected if ABSENT_LABEL in row["labels"]),
            "missing_checkout": sum(1 for row in expected if MISSING_CHECKOUT_LABEL in row["labels"]),
            "late": sum(1 for row in expected if LATE_LABEL in row["labels"]),
            "excused": sum(1 for row in expected if row["excused"]),
            "expected": len(expected),
        }

    def week(self, start: date, end: date, now: datetime | None = None) -> dict:
        days = []
        cursor = start
        while cursor <= end:
            days.append(self.day_summary(cursor, now))
            cursor += timedelta(days=1)
        return {"start": start.isoformat(), "end": end.isoformat(), "days": days}

    def day_detail(self, day: date, now: datetime | None = None) -> dict:
        notes = self._notes_by_employee(day)
        rows = []
        for employee in self._employees():
            row = self.employee_row(employee, day, now, notes)
            schedule, _ = resolve_employee_schedule(self.db, self.company_id, employee)
            window = window_for_date(self.db, schedule, day)
            start, end = window.get("start"), window.get("end")
            entries = []
            events = (
                self.db.query(XAttendanceEvent)
                .filter_by(company_id=self.company_id, employee_id=employee.id)
                .order_by(XAttendanceEvent.timestamp, XAttendanceEvent.id)
                .all()
            )
            for event in events:
                if start and end and start <= event.timestamp < end:
                    event_type = self.db.get(XAttendanceEventType, event.event_type_id)
                    title = event_type.name if event_type else "Evento"
                    detail = event.note or event.punctuality or event.source
                    entries.append({
                        "at": event.timestamp,
                        "kind": "attendance",
                        "kind_label": "Asistencia",
                        "title": title,
                        "detail": detail,
                        "state": event.state,
                    })
            note = notes.get(employee.id)
            if note:
                entries.append({
                    "at": datetime.combine(day, datetime.min.time()),
                    "kind": "permission",
                    "kind_label": "Permiso",
                    "title": PERMISSION_LABEL,
                    "detail": note.note or note.reason,
                    "state": note.state,
                })
            entries.sort(key=lambda item: item["at"] or datetime.min)
            rows.append({**row, "ledger": entries})
        expected = [row for row in rows if not row["is_off"]]
        issues = [row for row in expected if row["has_issue"]]
        has_issue = len(issues) > 0
        return {
            "date": day.isoformat(),
            "weekday": day.weekday(),
            "status": "issues" if has_issue else "ok",
            "status_label": ISSUES_LABEL if has_issue else OK_LABEL,
            "issue_count": len(issues),
            "present": sum(1 for row in expected if row["checked_in"]),
            "absent": sum(1 for row in expected if ABSENT_LABEL in row["labels"]),
            "missing_checkout": sum(1 for row in expected if MISSING_CHECKOUT_LABEL in row["labels"]),
            "late": sum(1 for row in expected if LATE_LABEL in row["labels"]),
            "excused": sum(1 for row in expected if row["excused"]),
            "expected": len(expected),
            "employees": rows,
        }
