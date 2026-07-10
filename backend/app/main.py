from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import assignments, attendance, auth, branches, companies, departments, devices, employee_statuses, employees, jobs, kiosk, no_attendance, permissions, phase4, roles, rules, users, temporary_pins

settings = get_settings()
docs_url = "/docs" if settings.environment == "development" else None
redoc_url = "/redoc" if settings.environment == "development" else None

app = FastAPI(
    title="Attendance SaaS", 
    version="0.1.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
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
app.include_router(temporary_pins.router, prefix="/api")
app.include_router(phase4.router, prefix="/api")


@app.get("/health")
def health() -> dict:
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
