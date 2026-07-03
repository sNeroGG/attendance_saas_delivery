from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import assignments, attendance, auth, branches, companies, departments, devices, employee_statuses, employees, jobs, kiosk, no_attendance, permissions, phase4, roles, rules, users

settings = get_settings()
app = FastAPI(title="Attendance SaaS", version="0.1.0")
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
app.include_router(phase4.router, prefix="/api")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "attendance_saas_backend"}
