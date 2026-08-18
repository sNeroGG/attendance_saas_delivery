from datetime import datetime

_last_attempt: dict[str, datetime] = {}
MIN_INTERVAL_SECONDS = 3


def check_rate_limit(key: str, min_interval_seconds: int = MIN_INTERVAL_SECONDS) -> bool:
    """Allows an attempt if at least 3 seconds passed since the last one. Never locks the user out."""
    now = datetime.utcnow()
    last = _last_attempt.get(key)
    if last and (now - last).total_seconds() < min_interval_seconds:
        return False
    _last_attempt[key] = now
    return True


def clear_rate_limit(key: str) -> None:
    _last_attempt.pop(key, None)
