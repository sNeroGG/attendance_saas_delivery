from datetime import datetime, timezone

from app.services.schedule_windows import classify_punch, line_window, parse_hhmm


def test_parse_hhmm():
    parsed = parse_hhmm("08:30")
    assert parsed.hour == 8
    assert parsed.minute == 30


def test_overnight_window_spans_next_day():
    bounds = line_window(datetime(2026, 8, 18).date(), "11:00", "03:00", False, True)
    assert bounds is not None
    start, end = bounds
    assert start.day == 18
    assert end.day == 19


def test_classify_late_checkin():
    start, end = line_window(datetime(2026, 8, 18).date(), "11:00", "03:00", False, True)
    moment = datetime(2026, 8, 18, 23, 0, tzinfo=timezone.utc).replace(tzinfo=None)
    result = classify_punch(moment, start, end, False, opens_shift=True)
    assert result["code"] == "late"
    assert result["allowed"] is True


def test_classify_off_day_requires_manager():
    result = classify_punch(datetime.utcnow(), None, None, True, opens_shift=True)
    assert result["code"] == "off_day"
    assert result["requires_manager"] is True
