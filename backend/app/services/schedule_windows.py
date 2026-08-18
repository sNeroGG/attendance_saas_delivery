from datetime import date, datetime, time, timedelta

from app.services.operational_day import TZ, as_local, as_utc

GRACE_LATE_MINUTES = 10
EARLY_OPEN_MINUTES = 120
EARLY_OUT_GRACE_MINUTES = 30


def parse_hhmm(value: str | None, fallback: str = "11:00") -> time:
    raw = (value or fallback).strip() or fallback
    parts = raw.split(":")
    hour = max(0, min(23, int(parts[0])))
    minute = max(0, min(59, int(parts[1]))) if len(parts) > 1 else 0
    return time(hour, minute)


def format_hhmm(value: time) -> str:
    return value.strftime("%H:%M")


def line_window(weekday_date: date, start_hhmm: str, end_hhmm: str, is_off: bool, overnight: bool | None = None) -> tuple[datetime, datetime] | None:
    if is_off:
        return None
    start_time = parse_hhmm(start_hhmm)
    end_time = parse_hhmm(end_hhmm, "03:00")
    crosses_midnight = overnight if overnight is not None else end_time <= start_time
    start_local = datetime.combine(weekday_date, start_time, tzinfo=TZ)
    end_date = weekday_date + timedelta(days=1) if crosses_midnight else weekday_date
    end_local = datetime.combine(end_date, end_time, tzinfo=TZ)
    return start_local, end_local


def to_naive_utc(moment: datetime) -> datetime:
    return as_utc(moment)


def classify_punch(
    moment: datetime | None,
    start_local: datetime | None,
    end_local: datetime | None,
    is_off: bool,
    opens_shift: bool = False,
    closes_shift: bool = False,
) -> dict:
    now_utc = as_utc(moment)
    if is_off or start_local is None or end_local is None:
        return {
            "allowed": False,
            "requires_manager": True,
            "code": "off_day",
            "label": "Día libre",
            "minutes": 0,
        }
    start_utc = to_naive_utc(start_local)
    end_utc = to_naive_utc(end_local)
    if opens_shift:
        early_from = start_utc - timedelta(minutes=EARLY_OPEN_MINUTES)
        if now_utc < early_from:
            return {
                "allowed": False,
                "requires_manager": True,
                "code": "too_early",
                "label": "Fuera de horario (muy temprano)",
                "minutes": int((start_utc - now_utc).total_seconds() // 60),
            }
        if now_utc >= end_utc:
            return {
                "allowed": False,
                "requires_manager": True,
                "code": "after_shift",
                "label": "La jornada ya terminó",
                "minutes": int((now_utc - end_utc).total_seconds() // 60),
            }
        if now_utc < start_utc:
            return {
                "allowed": True,
                "requires_manager": False,
                "code": "early",
                "label": "Entrada temprana",
                "minutes": int((start_utc - now_utc).total_seconds() // 60),
            }
        late_by = int((now_utc - start_utc).total_seconds() // 60)
        if late_by <= GRACE_LATE_MINUTES:
            return {"allowed": True, "requires_manager": False, "code": "on_time", "label": "A tiempo", "minutes": 0}
        return {
            "allowed": True,
            "requires_manager": False,
            "code": "late",
            "label": f"Tarde ({late_by} min)",
            "minutes": late_by,
        }
    if closes_shift:
        early_out = int((end_utc - now_utc).total_seconds() // 60)
        if now_utc < start_utc:
            return {
                "allowed": False,
                "requires_manager": True,
                "code": "too_early",
                "label": "Aún no inicia la jornada",
                "minutes": int((start_utc - now_utc).total_seconds() // 60),
            }
        if now_utc + timedelta(minutes=EARLY_OUT_GRACE_MINUTES) < end_utc:
            return {
                "allowed": True,
                "requires_manager": True,
                "code": "early_out",
                "label": f"Salida temprana ({max(early_out, 0)} min)",
                "minutes": max(early_out, 0),
            }
        return {"allowed": True, "requires_manager": False, "code": "on_time", "label": "A tiempo", "minutes": 0}
    if now_utc < start_utc or now_utc >= end_utc:
        return {
            "allowed": False,
            "requires_manager": True,
            "code": "outside",
            "label": "Fuera de horario",
            "minutes": 0,
        }
    return {"allowed": True, "requires_manager": False, "code": "on_time", "label": "A tiempo", "minutes": 0}
