from datetime import datetime, timedelta
from fastapi import HTTPException

_attempts: dict[str, list[datetime]] = {}
_locks: dict[str, datetime] = {}


def check_rate_limit(key: str, limit: int = 5, window_seconds: int = 60, lock_seconds: int = 120) -> None:
    now = datetime.utcnow()
    locked_until = _locks.get(key)
    if locked_until and locked_until > now:
        raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta mas tarde")
    window_start = now - timedelta(seconds=window_seconds)
    attempts = [item for item in _attempts.get(key, []) if item >= window_start]
    if len(attempts) >= limit:
        _locks[key] = now + timedelta(seconds=lock_seconds)
        _attempts[key] = []
        raise HTTPException(status_code=429, detail="Demasiados intentos. Bloqueo temporal aplicado")
    attempts.append(now)
    _attempts[key] = attempts


def clear_rate_limit(key: str) -> None:
    _attempts.pop(key, None)
    _locks.pop(key, None)
