from contextlib import asynccontextmanager
import logging
import threading
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.routes import assignments, attendance, auth, branches, companies, departments, devices, employee_statuses, employees, jobs, kiosk, no_attendance, permissions, phase4, roles, rules, schedules, setup, users, temporary_pins

logger = logging.getLogger(__name__)


def run_auto_checkout_loop(stop: threading.Event) -> None:
    from app.database import SessionLocal
    from app.services.auto_checkout import process_all_companies
    while True:
        try:
            db = SessionLocal()
            try:
                acquired = db.execute(text("SELECT GET_LOCK('attendance_saas:auto_checkout', 0)")).scalar()
                if acquired == 1:
                    try:
                        process_all_companies(db)
                    finally:
                        db.rollback()
                        db.execute(text("SELECT RELEASE_LOCK('attendance_saas:auto_checkout')"))
            finally:
                db.close()
        except Exception as exc:
            logger.exception("Auto-checkout scheduler iteration failed: %s", exc)
        if stop.wait(300):
            break


@asynccontextmanager
async def lifespan(_app: FastAPI):
    stop = threading.Event()
    thread = threading.Thread(target=run_auto_checkout_loop, args=(stop,), daemon=True, name="auto-checkout")
    thread.start()
    yield
    stop.set()


settings = get_settings()
docs_url = "/docs" if settings.environment == "development" else None
redoc_url = "/redoc" if settings.environment == "development" else None

app = FastAPI(
    title="Attendance SaaS", 
    version="0.1.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(companies.router, prefix="/api")
app.include_router(branches.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(employees.router, prefix="/api")
app.include_router(employee_statuses.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(roles.router, prefix="/api")
app.include_router(permissions.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(kiosk.router, prefix="/api")
app.include_router(no_attendance.router, prefix="/api")
app.include_router(assignments.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(schedules.router, prefix="/api")
app.include_router(temporary_pins.router, prefix="/api")
app.include_router(setup.router, prefix="/api")
app.include_router(phase4.router, prefix="/api")


@app.get("/health")
def health() -> dict:
    from app.database import engine
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            config_path = Path(__file__).resolve().parents[1] / "alembic.ini"
            migration_config = Config(str(config_path))
            migration_config.set_main_option("script_location", str(config_path.parent / "alembic"))
            expected_heads = set(ScriptDirectory.from_config(migration_config).get_heads())
            applied_heads = set(MigrationContext.configure(connection).get_current_heads())
            if applied_heads != expected_heads:
                raise RuntimeError("Database migrations are not at the application revision")
        from app.security.rate_limit import redis_is_available
        if not redis_is_available():
            raise RuntimeError("Redis unavailable")
    except Exception as exc:
        logger.warning("Health check failed: dependency unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Critical dependency unavailable") from exc
    return {"status": "ok", "service": "attendance_saas_backend"}


from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

@app.exception_handler(IntegrityError)
def integrity_error_handler(request, exc: IntegrityError):
    error_msg = str(exc.orig) if exc.orig else str(exc)
    if "Duplicate entry" in error_msg:
        return JSONResponse(
            status_code=400,
            content={"detail": "El nombre de usuario (login) ya está registrado en el sistema. Elija otro nombre único."}
        )
    return JSONResponse(
        status_code=400,
        content={"detail": "Error de integridad de datos."}
    )
