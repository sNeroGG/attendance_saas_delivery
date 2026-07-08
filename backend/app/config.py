from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "mysql+pymysql://attendance_user:change_me@mysql:3306/attendance_saas?charset=utf8mb4"
    secret_key: str = "change_me_to_a_long_random_secret"
    access_token_expire_minutes: int = 480
    cors_origins: str = "http://localhost:5175,http://127.0.0.1:5175"
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
