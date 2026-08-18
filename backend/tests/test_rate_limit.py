from app.security.rate_limit import check_rate_limit, clear_rate_limit


def test_rate_limit_allows_first_attempt_and_blocks_until_interval():
    key = "test:pin:kiosk"
    clear_rate_limit(key)
    assert check_rate_limit(key, min_interval_seconds=3) is True
    assert check_rate_limit(key, min_interval_seconds=3) is False
    clear_rate_limit(key)
    assert check_rate_limit(key, min_interval_seconds=3) is True
    clear_rate_limit(key)


def test_rate_limit_never_raises():
    key = "test:face:kiosk"
    clear_rate_limit(key)
    check_rate_limit(key)
    check_rate_limit(key)
    clear_rate_limit(key)
