from datetime import date, datetime, timezone

from app.services.operational_day import classify_employee_day, past_missing_checkout_deadline


def _utc(year, month, day, hour, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc).replace(tzinfo=None)


def test_missing_checkout_is_one_hour_after_end():
    end = _utc(2026, 8, 13, 9, 0)
    assert not past_missing_checkout_deadline(end, _utc(2026, 8, 13, 9, 0))
    assert not past_missing_checkout_deadline(end, _utc(2026, 8, 13, 9, 59))
    assert past_missing_checkout_deadline(end, _utc(2026, 8, 13, 10, 0))


def test_excused_absence_is_not_an_issue():
    result = classify_employee_day(
        day=date(2026, 8, 18),
        today=date(2026, 8, 18),
        now=_utc(2026, 8, 18, 20, 0),
        is_off=False,
        excused=True,
        checked_in=False,
        checked_out=False,
        auto_closed=False,
        late=False,
        window_start=_utc(2026, 8, 18, 17, 0),
        window_end=_utc(2026, 8, 19, 9, 0),
    )
    assert result["has_issue"] is False
    assert "Permiso" in result["labels"]


def test_missing_checkin_after_start_is_absent():
    result = classify_employee_day(
        day=date(2026, 8, 17),
        today=date(2026, 8, 18),
        now=_utc(2026, 8, 18, 20, 0),
        is_off=False,
        excused=False,
        checked_in=False,
        checked_out=False,
        auto_closed=False,
        late=False,
        window_start=_utc(2026, 8, 17, 17, 0),
        window_end=_utc(2026, 8, 18, 9, 0),
    )
    assert result["has_issue"] is True
    assert "Faltó" in result["labels"]


def test_auto_closed_shift_is_missing_checkout():
    result = classify_employee_day(
        day=date(2026, 8, 17),
        today=date(2026, 8, 18),
        now=_utc(2026, 8, 18, 20, 0),
        is_off=False,
        excused=False,
        checked_in=True,
        checked_out=True,
        auto_closed=True,
        late=False,
        window_start=_utc(2026, 8, 17, 17, 0),
        window_end=_utc(2026, 8, 18, 9, 0),
    )
    assert result["has_issue"] is True
    assert "No marcó salida" in result["labels"]
