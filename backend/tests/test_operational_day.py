from datetime import datetime, timezone

from app.services.operational_day import (
    SHIFT_LABEL,
    evaluate_compliance,
    operational_window,
    should_auto_close,
    slug_login,
    window_contains,
)


def _utc(year, month, day, hour, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc).replace(tzinfo=None)


def test_shift_label_is_eleven_to_three():
    assert SHIFT_LABEL == "11:00 – 03:00"


def test_window_during_afternoon_starts_today_11():
    # 20:00 UTC = 14:00 El Salvador
    start, end = operational_window(_utc(2026, 8, 12, 20, 0))
    assert start == _utc(2026, 8, 12, 17, 0)
    assert end == _utc(2026, 8, 13, 9, 0)


def test_window_after_midnight_still_same_shift():
    # 07:00 UTC = 01:00 El Salvador (still inside 11:00-03:00)
    start, end = operational_window(_utc(2026, 8, 13, 7, 0))
    assert start == _utc(2026, 8, 12, 17, 0)
    assert end == _utc(2026, 8, 13, 9, 0)


def test_window_in_morning_gap_uses_closed_shift():
    # 14:00 UTC = 08:00 El Salvador (between 03:00 and 11:00)
    start, end = operational_window(_utc(2026, 8, 13, 14, 0))
    assert start == _utc(2026, 8, 12, 17, 0)
    assert end == _utc(2026, 8, 13, 9, 0)
    assert not window_contains(_utc(2026, 8, 13, 14, 0), start, end)


def test_auto_close_after_three_am():
    check_in = _utc(2026, 8, 12, 18, 0)  # 12:00 SV
    assert not should_auto_close(check_in, _utc(2026, 8, 13, 9, 0))  # 03:00 SV
    assert not should_auto_close(check_in, _utc(2026, 8, 13, 9, 59))  # 03:59 SV
    assert should_auto_close(check_in, _utc(2026, 8, 13, 10, 0))  # 04:00 SV


def test_compliance_requires_checkin_and_tasks():
    missing_checkin = evaluate_compliance(False, 0)
    assert missing_checkin["compliant"] is False
    assert "Sin check-in" in missing_checkin["issues"]

    pending_tasks = evaluate_compliance(True, 2)
    assert pending_tasks["compliant"] is False
    assert "Tareas pendientes" in pending_tasks["issues"]

    ok = evaluate_compliance(True, 0)
    assert ok["compliant"] is True
    assert ok["issues"] == []


def test_slug_login_from_name():
    assert slug_login("María López") == "maria.lopez"
    assert slug_login("  Ana  ") == "ana"
    assert slug_login("") == "empleado"


def test_next_prefixed_code_skips_existing():
    from app.services.operational_day import next_prefixed_code
    assert next_prefixed_code("KIOSK", []) == "KIOSK-001"
    assert next_prefixed_code("KIOSK", ["KIOSK-001", "KIOSK-002"]) == "KIOSK-003"
