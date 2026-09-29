from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
import re
import unicodedata

TZ = ZoneInfo("America/El_Salvador")
SHIFT_START = time(11, 0)
SHIFT_END = time(3, 0)
SHIFT_LABEL = "11:00 – 03:00"
DEFAULT_EMPLOYEE_TYPE = "fixed"
COMPLETED_TASK_STATES = {"completed", "validated", "cancelled"}
KIND_LABELS = {
    "attendance": "Asistencia",
    "task": "Checklist",
    "task_answer": "Checklist",
    "audit": "Sistema",
    "biometric": "Acceso",
}


def as_utc(moment: datetime | None = None) -> datetime:
    if moment is None:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    if moment.tzinfo is None:
        return moment
    return moment.astimezone(timezone.utc).replace(tzinfo=None)


def as_local(moment: datetime | None = None) -> datetime:
    if moment is None:
        return datetime.now(timezone.utc).astimezone(TZ)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(TZ)


def operational_window(moment: datetime | None = None) -> tuple[datetime, datetime]:
    """UTC-naive (start, end) of the operational day that contains `moment`.

    The working window is 11:00 to 03:00 the next calendar day (America/El_Salvador).
    Times between 03:00 and 11:00 belong to the window that just closed.
    """
    local = as_local(moment)
    local_date = local.date()
    if local.time() >= SHIFT_START:
        start_local = datetime.combine(local_date, SHIFT_START, tzinfo=TZ)
    else:
        start_local = datetime.combine(local_date - timedelta(days=1), SHIFT_START, tzinfo=TZ)
    end_local = start_local + timedelta(hours=16)
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


def is_within_shift_window(moment: datetime | None = None) -> bool:
    start, end = operational_window(moment)
    current = as_utc(moment)
    return start <= current < end


def window_contains(moment: datetime, start: datetime, end: datetime) -> bool:
    value = as_utc(moment)
    return start <= value < end


MISSING_CHECKOUT_GRACE = timedelta(hours=1)
EXCUSED_REASONS = {"permiso", "excused", "falta_justificada"}
MISSING_CHECKOUT_LABEL = "No marcó salida"
ABSENT_LABEL = "Faltó"
LATE_LABEL = "Tarde"
PERMISSION_LABEL = "Permiso"
OK_LABEL = "Todo bien"
ISSUES_LABEL = "Algún detalle"


def past_missing_checkout_deadline(window_end: datetime | None, moment: datetime | None = None) -> bool:
    if window_end is None:
        return False
    return as_utc(moment) >= as_utc(window_end) + MISSING_CHECKOUT_GRACE


def should_auto_close(check_in_at: datetime, moment: datetime | None = None) -> bool:
    _, window_end = operational_window(check_in_at)
    return past_missing_checkout_deadline(window_end, moment)


def classify_employee_day(
    *,
    day: date,
    today: date,
    now: datetime,
    is_off: bool,
    excused: bool,
    checked_in: bool,
    checked_out: bool,
    auto_closed: bool,
    late: bool,
    window_start: datetime | None,
    window_end: datetime | None,
) -> dict:
    labels: list[str] = []
    if is_off and not checked_in:
        return {
            "status": "off",
            "status_label": "Día libre",
            "labels": ["Día libre"],
            "has_issue": False,
            "excused": False,
        }
    if excused:
        labels.append(PERMISSION_LABEL)
        if not checked_in:
            return {
                "status": "ok",
                "status_label": PERMISSION_LABEL,
                "labels": labels,
                "has_issue": False,
                "excused": True,
            }
    if not checked_in:
        if day > today:
            return {
                "status": "pending",
                "status_label": "Pendiente",
                "labels": ["Pendiente"],
                "has_issue": False,
                "excused": False,
            }
        if day == today and window_start and as_utc(now) < as_utc(window_start) + timedelta(minutes=10):
            return {
                "status": "pending",
                "status_label": "Pendiente",
                "labels": ["Aún no inicia"],
                "has_issue": False,
                "excused": False,
            }
        labels.append(ABSENT_LABEL)
        return {
            "status": "issues",
            "status_label": ABSENT_LABEL,
            "labels": labels,
            "has_issue": True,
            "excused": False,
        }
    if late:
        labels.append(LATE_LABEL)
    missing_out = auto_closed or (
        checked_in and not checked_out and past_missing_checkout_deadline(window_end, now)
    )
    if missing_out:
        labels.append(MISSING_CHECKOUT_LABEL)
    elif checked_in and not checked_out:
        labels.append("En jornada")
    has_issue = LATE_LABEL in labels or MISSING_CHECKOUT_LABEL in labels or (is_off and checked_in)
    if is_off and checked_in:
        labels.append("Marcó en día libre")
    if not labels:
        labels = [OK_LABEL]
    return {
        "status": "issues" if has_issue else "ok",
        "status_label": ISSUES_LABEL if has_issue else OK_LABEL,
        "labels": labels,
        "has_issue": has_issue,
        "excused": excused,
    }


def evaluate_compliance(checked_in: bool, required_pending: int, is_off: bool = False, late: bool = False) -> dict:
    issues: list[str] = []
    if is_off and not checked_in:
        return {
            "checked_in": False,
            "required_pending": required_pending,
            "compliant": required_pending == 0,
            "issues": ["Tareas pendientes"] if required_pending > 0 else [],
        }
    if not checked_in:
        issues.append("Sin check-in")
    if late:
        issues.append("Llegó tarde")
    if is_off and checked_in:
        issues.append("Marcó en día libre")
    if required_pending > 0:
        issues.append("Tareas pendientes")
    return {
        "checked_in": checked_in,
        "required_pending": required_pending,
        "compliant": len(issues) == 0,
        "issues": issues,
    }


def next_prefixed_code(prefix: str, existing: list[str]) -> str:
    for index in range(1, 1000):
        code = f"{prefix}-{str(index).zfill(3)}"
        if code not in existing:
            return code
    return f"{prefix}-{len(existing) + 1}"


def slug_login(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", ".", normalized.lower()).strip(".")
    return slug or "empleado"


def merge_employee_defaults(data: dict, org: dict, next_code: str, today: date | None = None) -> dict:
    payload = dict(data)
    name = (payload.get("name") or "").strip()
    if name and not payload.get("first_name") and not payload.get("last_name"):
        parts = name.split(None, 1)
        payload["first_name"] = parts[0]
        payload["last_name"] = parts[1] if len(parts) > 1 else None
    payload["employee_type"] = payload.get("employee_type") or DEFAULT_EMPLOYEE_TYPE
    payload["employee_code"] = payload.get("employee_code") or next_code
    payload["branch_id"] = payload.get("branch_id") or org.get("branch_id")
    payload["department_id"] = payload.get("department_id") or org.get("department_id")
    payload["job_id"] = payload.get("job_id") or org.get("job_id")
    payload["job_title"] = payload.get("job_title") or org.get("job_title")
    payload["employment_status_id"] = payload.get("employment_status_id") or org.get("employment_status_id")
    payload["is_active_for_work"] = True if payload.get("is_active_for_work") is None else payload["is_active_for_work"]
    payload["active"] = True if payload.get("active") is None else payload["active"]
    payload["hire_date"] = payload.get("hire_date") or today or date.today()
    payload["create_user_profile"] = True if payload.get("create_user_profile") is None else payload["create_user_profile"]
    payload["user_login"] = payload.get("user_login") or slug_login(name or payload["employee_code"])
    return payload
