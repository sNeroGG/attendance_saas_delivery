from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models import (
    HrEmployee,
    ResCompany,
    XEmployeeRole,
    XRole,
    XWorkSchedule,
    XWorkScheduleLine,
)
from app.services.operational_day import SHIFT_LABEL, as_local, as_utc, operational_window
from app.services.schedule_windows import classify_punch, line_window

WEEKDAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]
DEFAULT_START = "11:00"
DEFAULT_END = "03:00"


def default_lines_payload() -> list[dict]:
    overnight = DEFAULT_END < DEFAULT_START
    return [
        {
            "weekday": weekday,
            "start_time": DEFAULT_START,
            "end_time": DEFAULT_END,
            "is_off": False,
            "overnight": overnight,
        }
        for weekday in range(7)
    ]


def serialize_schedule(db: Session, schedule: XWorkSchedule) -> dict:
    lines = (
        db.query(XWorkScheduleLine)
        .filter_by(company_id=schedule.company_id, schedule_id=schedule.id)
        .order_by(XWorkScheduleLine.weekday, XWorkScheduleLine.id)
        .all()
    )
    return {
        "id": schedule.id,
        "company_id": schedule.company_id,
        "name": schedule.name,
        "description": schedule.description,
        "timezone": schedule.timezone,
        "active": schedule.active,
        "is_default": schedule.is_default,
        "lines": [
            {
                "id": line.id,
                "schedule_id": line.schedule_id,
                "weekday": line.weekday,
                "start_time": line.start_time,
                "end_time": line.end_time,
                "is_off": line.is_off,
                "overnight": line.overnight,
            }
            for line in lines
        ],
    }


def sync_schedule_lines(db: Session, schedule: XWorkSchedule, lines: list, user_id: int) -> None:
    db.query(XWorkScheduleLine).filter_by(company_id=schedule.company_id, schedule_id=schedule.id).delete()
    payload = [item.model_dump() if hasattr(item, "model_dump") else dict(item) for item in lines]
    if not payload:
        payload = default_lines_payload()
    seen: set[int] = set()
    for item in payload:
        weekday = int(item.get("weekday", 0))
        if weekday < 0 or weekday > 6 or weekday in seen:
            continue
        seen.add(weekday)
        start_time = (item.get("start_time") or DEFAULT_START)[:8]
        end_time = (item.get("end_time") or DEFAULT_END)[:8]
        is_off = bool(item.get("is_off"))
        overnight = bool(item.get("overnight", end_time < start_time))
        db.add(XWorkScheduleLine(
            company_id=schedule.company_id,
            schedule_id=schedule.id,
            weekday=weekday,
            start_time=start_time,
            end_time=end_time,
            is_off=is_off,
            overnight=overnight,
            create_uid=user_id,
            write_uid=user_id,
        ))
    for weekday in range(7):
        if weekday in seen:
            continue
        db.add(XWorkScheduleLine(
            company_id=schedule.company_id,
            schedule_id=schedule.id,
            weekday=weekday,
            start_time=DEFAULT_START,
            end_time=DEFAULT_END,
            is_off=True,
            overnight=DEFAULT_END < DEFAULT_START,
            create_uid=user_id,
            write_uid=user_id,
        ))


def clear_other_defaults(db: Session, company_id: int, keep_id: int | None = None) -> None:
    query = db.query(XWorkSchedule).filter_by(company_id=company_id, is_default=True)
    if keep_id is not None:
        query = query.filter(XWorkSchedule.id != keep_id)
    for item in query.all():
        item.is_default = False
    company = db.get(ResCompany, company_id)
    if company is not None:
        company.default_schedule_id = keep_id


def set_default_schedule(db: Session, company_id: int, schedule: XWorkSchedule, user_id: int) -> XWorkSchedule:
    clear_other_defaults(db, company_id, schedule.id)
    schedule.is_default = True
    schedule.write_uid = user_id
    company = db.get(ResCompany, company_id)
    if company is not None:
        company.default_schedule_id = schedule.id
        company.write_uid = user_id
    return schedule


def ensure_default_schedule(db: Session, company_id: int, user_id: int) -> XWorkSchedule:
    company = db.get(ResCompany, company_id)
    schedule = None
    if company and company.default_schedule_id:
        schedule = db.get(XWorkSchedule, company.default_schedule_id)
        if schedule and schedule.company_id == company_id and schedule.active:
            if not schedule.is_default:
                set_default_schedule(db, company_id, schedule, user_id)
            return schedule
    schedule = db.query(XWorkSchedule).filter_by(company_id=company_id, is_default=True, active=True).first()
    if schedule:
        if company is not None and company.default_schedule_id != schedule.id:
            company.default_schedule_id = schedule.id
        return schedule
    schedule = db.query(XWorkSchedule).filter_by(company_id=company_id, active=True).order_by(XWorkSchedule.id).first()
    if not schedule:
        schedule = XWorkSchedule(
            company_id=company_id,
            name="Jornada 11:00-03:00",
            description="Horario predeterminado de la empresa",
            timezone="America/El_Salvador",
            is_default=True,
            create_uid=user_id,
            write_uid=user_id,
        )
        db.add(schedule)
        db.flush()
        sync_schedule_lines(db, schedule, default_lines_payload(), user_id)
    set_default_schedule(db, company_id, schedule, user_id)
    return schedule


def resolve_employee_schedule(db: Session, company_id: int, employee: HrEmployee) -> tuple[XWorkSchedule | None, str]:
    if employee.schedule_id:
        schedule = db.get(XWorkSchedule, employee.schedule_id)
        if schedule and schedule.company_id == company_id and schedule.active:
            return schedule, "employee"
    role_ids = [row.role_id for row in db.query(XEmployeeRole).filter_by(employee_id=employee.id).all()]
    if role_ids:
        role = (
            db.query(XRole)
            .filter(XRole.company_id == company_id, XRole.id.in_(role_ids), XRole.active == True, XRole.schedule_id.isnot(None))  # noqa: E712
            .order_by(XRole.id)
            .first()
        )
        if role and role.schedule_id:
            schedule = db.get(XWorkSchedule, role.schedule_id)
            if schedule and schedule.company_id == company_id and schedule.active:
                return schedule, "role"
    default = db.query(XWorkSchedule).filter_by(company_id=company_id, is_default=True, active=True).first()
    if default:
        return default, "default"
    fallback = db.query(XWorkSchedule).filter_by(company_id=company_id, active=True).order_by(XWorkSchedule.id).first()
    return fallback, "default"


def employee_role_name(db: Session, company_id: int, employee_id: int) -> str | None:
    link = db.query(XEmployeeRole).filter_by(employee_id=employee_id).first()
    if not link:
        return None
    role = db.get(XRole, link.role_id)
    if role and role.company_id == company_id:
        return role.name
    return None


def employee_role_id(db: Session, employee_id: int) -> int | None:
    link = db.query(XEmployeeRole).filter_by(employee_id=employee_id).first()
    return link.role_id if link else None


def sync_employee_role(db: Session, employee_id: int, role_id: int | None, user_id: int) -> None:
    db.query(XEmployeeRole).filter_by(employee_id=employee_id).delete()
    if role_id:
        db.add(XEmployeeRole(employee_id=employee_id, role_id=role_id, create_uid=user_id))


def _lines_by_weekday(db: Session, schedule: XWorkSchedule) -> dict[int, XWorkScheduleLine]:
    rows = db.query(XWorkScheduleLine).filter_by(company_id=schedule.company_id, schedule_id=schedule.id).all()
    return {row.weekday: row for row in rows}


def window_for_date(db: Session, schedule: XWorkSchedule | None, local_date: date) -> dict:
    if schedule is None:
        from app.services.operational_day import SHIFT_END, SHIFT_START
        bounds = line_window(local_date, SHIFT_START.strftime("%H:%M"), SHIFT_END.strftime("%H:%M"), False, True)
        start_local, end_local = bounds if bounds else (None, None)
        return {
            "is_off": False,
            "start": as_utc(start_local) if start_local else None,
            "end": as_utc(end_local) if end_local else None,
            "start_local": start_local,
            "end_local": end_local,
            "label": SHIFT_LABEL,
            "weekday": local_date.weekday(),
        }
    line = _lines_by_weekday(db, schedule).get(local_date.weekday())
    if line is None or line.is_off:
        return {
            "is_off": True,
            "start": None,
            "end": None,
            "start_local": None,
            "end_local": None,
            "label": "Día libre",
            "weekday": local_date.weekday(),
        }
    bounds = line_window(local_date, line.start_time, line.end_time, False, line.overnight)
    start_local, end_local = bounds if bounds else (None, None)
    label = f"{line.start_time} – {line.end_time}"
    return {
        "is_off": False,
        "start": as_utc(start_local) if start_local else None,
        "end": as_utc(end_local) if end_local else None,
        "start_local": start_local,
        "end_local": end_local,
        "label": label,
        "weekday": local_date.weekday(),
    }


def current_window(db: Session, schedule: XWorkSchedule | None, moment: datetime | None = None) -> dict:
    local = as_local(moment)
    previous_date = local.date() - timedelta(days=1)
    previous = window_for_date(db, schedule, previous_date)
    if previous["start_local"] and previous["end_local"] and previous["start_local"] <= local < previous["end_local"]:
        return previous
    today = window_for_date(db, schedule, local.date())
    if today["start_local"] and today["end_local"] and today["start_local"] <= local < today["end_local"]:
        return today
    # before today's start: still describe today's planned window
    return today


def describe_employee_work(db: Session, company_id: int, employee: HrEmployee, moment: datetime | None = None, opens_shift: bool = False, closes_shift: bool = False) -> dict:
    schedule, source = resolve_employee_schedule(db, company_id, employee)
    window = current_window(db, schedule, moment)
    punch = classify_punch(moment, window["start_local"], window["end_local"], window["is_off"], opens_shift, closes_shift)
    auto_close_label = window["label"] if not window["is_off"] else "—"
    return {
        "schedule_id": schedule.id if schedule else None,
        "schedule_name": schedule.name if schedule else "Jornada 11:00–03:00",
        "source": source if schedule else "default",
        "is_off": window["is_off"],
        "label": window["label"],
        "start": window["start"],
        "end": window["end"],
        "weekday": window["weekday"],
        "auto_checkout_label": None if window["is_off"] else (window["end_local"].strftime("%H:%M") if window["end_local"] else "03:00"),
        "punch": punch,
        "auto_close_at": window["end"],
    }


def company_default_window(db: Session, company_id: int, moment: datetime | None = None) -> dict:
    schedule = db.query(XWorkSchedule).filter_by(company_id=company_id, is_default=True, active=True).first()
    window = current_window(db, schedule, moment)
    if window["start"] is None:
        start, end = operational_window(moment)
        return {
            "start": start,
            "end": end,
            "label": SHIFT_LABEL,
            "is_off": False,
            "report_date": as_local(start).date() if start else as_local(moment).date(),
        }
    report_date = window["start_local"].date() if window["start_local"] else as_local(moment).date()
    return {**window, "report_date": report_date, "label": window["label"] if not window["is_off"] else SHIFT_LABEL}


def should_auto_close_shift(db: Session, company_id: int, employee: HrEmployee, check_in_at: datetime, moment: datetime | None = None) -> bool:
    schedule, _ = resolve_employee_schedule(db, company_id, employee)
    local_checkin = as_local(check_in_at)
    previous = window_for_date(db, schedule, local_checkin.date() - timedelta(days=1))
    today = window_for_date(db, schedule, local_checkin.date())
    end = None
    if previous["start"] and previous["end"] and previous["start"] <= as_utc(check_in_at) < previous["end"]:
        end = previous["end"]
    elif today["end"]:
        end = today["end"]
    if end is None:
        from app.services.operational_day import should_auto_close
        return should_auto_close(check_in_at, moment)
    return as_utc(moment) >= end
