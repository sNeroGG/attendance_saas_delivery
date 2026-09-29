from functools import lru_cache
from urllib.parse import urlsplit
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "mysql+pymysql://attendance_user:change_me@mysql:3306/attendance_saas?charset=utf8mb4"
    secret_key: str = "change_me_to_a_long_random_secret"
    access_token_expire_minutes: int = 480
    cors_origins: str = "http://localhost:5175,http://127.0.0.1:5175"
    environment: str = "development"
    redis_url: str | None = None
    enable_biometrics: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.environment.lower() == "production":
            if len(self.secret_key) < 32 or "change_me" in self.secret_key.lower():
                raise ValueError("SECRET_KEY must be a unique random value of at least 32 characters in production")
            if "change_me" in self.database_url.lower() or "change_me" in (self.redis_url or "").lower():
                raise ValueError("Replace all example database and Redis credentials before production")
            if not self.redis_url:
                raise ValueError("REDIS_URL is required in production for shared rate limiting")
            try:
                database_password = urlsplit(self.database_url).password or ""
                redis_password = urlsplit(self.redis_url).password or ""
            except ValueError as exc:
                raise ValueError("DATABASE_URL or REDIS_URL is invalid") from exc
            if len(database_password) < 20 or len(redis_password) < 24:
                raise ValueError("Use at least 20 characters for MySQL and 24 for Redis production passwords")
            if self.access_token_expire_minutes > 120:
                raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES must be 120 or less in production")
            if not self.cors_origin_list or any("localhost" in origin or "127.0.0.1" in origin for origin in self.cors_origin_list):
                raise ValueError("CORS_ORIGINS must contain only the production frontend origins")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
