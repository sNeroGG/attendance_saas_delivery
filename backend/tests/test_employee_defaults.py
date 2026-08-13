from datetime import date

from app.services.operational_day import (
    DEFAULT_EMPLOYEE_TYPE,
    merge_employee_defaults,
    slug_login,
)


def test_merge_employee_defaults_fills_only_missing_fields():
    data = merge_employee_defaults(
        {"name": "Carlos Pérez"},
        {
            "branch_id": 1,
            "department_id": 1,
            "job_id": 1,
            "job_title": "Colaborador",
            "employment_status_id": 1,
        },
        "EMP-003",
        today=date(2026, 8, 12),
    )
    assert data["name"] == "Carlos Pérez"
    assert data["first_name"] == "Carlos"
    assert data["last_name"] == "Pérez"
    assert data["employee_type"] == DEFAULT_EMPLOYEE_TYPE
    assert data["employee_code"] == "EMP-003"
    assert data["branch_id"] == 1
    assert data["department_id"] == 1
    assert data["job_id"] == 1
    assert data["job_title"] == "Colaborador"
    assert data["employment_status_id"] == 1
    assert data["create_user_profile"] is True
    assert data["user_login"] == "carlos.perez"
    assert data["is_active_for_work"] is True
    assert data["active"] is True
    assert data["hire_date"] == date(2026, 8, 12)


def test_merge_employee_defaults_does_not_override_explicit_values():
    data = merge_employee_defaults(
        {
            "name": "Ana",
            "employee_code": "EMP-100",
            "user_login": "ana.admin",
            "employee_type": "fixed",
            "branch_id": 9,
        },
        {"branch_id": 1, "department_id": 1, "job_id": 1, "job_title": "Colaborador", "employment_status_id": 1},
        "EMP-003",
    )
    assert data["employee_code"] == "EMP-100"
    assert data["user_login"] == "ana.admin"
    assert data["branch_id"] == 9
    assert slug_login("Ana") == "ana"
