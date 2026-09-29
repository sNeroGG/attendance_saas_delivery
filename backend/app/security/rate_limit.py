from datetime import datetime
import logging

import redis
from fastapi import HTTPException

from app.config import get_settings

_last_attempt: dict[str, datetime] = {}
_redis_client: redis.Redis | None = None
logger = logging.getLogger(__name__)

_CHECK_ATTEMPT = """
local attempts = KEYS[1]
local cooldown = KEYS[2]
if redis.call('EXISTS', cooldown) == 1 then return 0 end
local count = redis.call('INCR', attempts)
if count == 1 then redis.call('EXPIRE', attempts, ARGV[1]) end
if count > tonumber(ARGV[2]) then return -1 end
redis.call('SET', cooldown, '1', 'EX', ARGV[3])
return 1
"""


def check_rate_limit(key: str, min_interval_seconds: int = 3) -> bool:
    settings = get_settings()
    if settings.redis_url:
        global _redis_client
        try:
            if _redis_client is None:
                _redis_client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
            allowed = _redis_client.eval(
                _CHECK_ATTEMPT,
                2,
                f"attendance:attempts:{key}",
                f"attendance:cooldown:{key}",
                900,
                5,
                min_interval_seconds,
            )
            return allowed == 1
        except redis.RedisError as exc:
            if settings.environment.lower() == "production":
                raise HTTPException(status_code=503, detail="El control de intentos no está disponible") from exc

    now = datetime.utcnow()
    last = _last_attempt.get(key)
    if last and (now - last).total_seconds() < min_interval_seconds:
        return False
    _last_attempt[key] = now
    return True


def clear_rate_limit(key: str) -> None:
    settings = get_settings()
    if settings.redis_url and _redis_client is not None:
        try:
            _redis_client.delete(f"attendance:attempts:{key}", f"attendance:cooldown:{key}")
        except redis.RedisError as exc:
            logger.warning("Unable to clear successful rate limit for %s: %s", key, exc)
    _last_attempt.pop(key, None)


def redis_is_available() -> bool:
    settings = get_settings()
    if not settings.redis_url:
        return settings.environment.lower() != "production"
    global _redis_client
    try:
        if _redis_client is None:
            _redis_client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
        return bool(_redis_client.ping())
    except redis.RedisError:
        return False
