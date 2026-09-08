import json
import os
import time
import urllib.error
import urllib.request
import uuid

import pytest

BASE = os.environ.get("SMOKE_API_URL", "http://127.0.0.1:8000").rstrip("/")


def _call(method: str, path: str, body=None, token: str | None = None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(f"{BASE}{path}", data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode() or "{}"
            payload = json.loads(raw) if raw else {}
            return response.status, payload
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            payload = json.loads(raw) if raw else {"detail": str(exc)}
        except json.JSONDecodeError:
            payload = {"detail": raw or str(exc)}
        return exc.code, payload


def api_available() -> bool:
    try:
        status, payload = _call("GET", "/health")
        return status == 200 and payload.get("status") == "ok"
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not api_available(), reason="API de Docker no disponible")


def _ok(status: int, payload, expected=200):
    assert status == expected, payload
    return payload


def test_health_and_full_admin_kiosk_cycle():
    stamp = uuid.uuid4().hex[:8]
    pin = str(1000 + (int(stamp[:4], 16) % 9000))

    payload = _ok(*_call("GET", "/health"))
    assert payload["service"] == "attendance_saas_backend"

    login = _ok(*_call("POST", "/api/auth/login", {"login": "admin", "password": "admin123"}))
    token = login["access_token"]
    assert login["user"]["login"] == "admin"
    me = _ok(*_call("GET", "/api/auth/me", token=token))
    assert me["login"] == "admin"

    for path in (
        "/api/companies/current",
        "/api/employees",
        "/api/users",
        "/api/devices",
        "/api/branches",
        "/api/departments",
        "/api/jobs",
        "/api/roles",
        "/api/permissions",
        "/api/work-schedules",
        "/api/work-schedules/overview",
        "/api/attendance/event-types",
        "/api/assignment-templates",
        "/api/employee-assignments",
        "/api/reports/dashboard",
        "/api/reports/daily",
        "/api/reports/hours",
        "/api/reports/assignments",
        "/api/reports/attendance-exceptions",
        "/api/reports/audit",
        "/api/auto-checkout-rules",
        "/api/biometric-logs",
        "/api/audit-logs",
    ):
        status, payload = _call("GET", path, token=token)
        assert status == 200, f"{path} -> {status} {payload}"

    dashboard = _ok(*_call("GET", "/api/reports/dashboard", token=token))
    assert "summary" in dashboard and "operational_day" in dashboard

    kiosk = _ok(*_call("GET", "/api/kiosk/KIOSK-DEMO/config"))
    assert kiosk["device"]["device_code"] == "KIOSK-DEMO"
    unlock_status, unlock_payload = _call("POST", "/api/kiosk/unlock-device", {"device_code": "KIOSK-DEMO", "pin": "1234"})
    assert unlock_status == 200, unlock_payload

    template = _ok(*_call("POST", "/api/assignment-templates", {
        "name": f"Smoke {stamp}",
        "state": "active",
        "active": True,
        "tasks": [
            {"name": "Revisar caja", "description": "Contar efectivo de apertura"},
            {"name": "Revisar piso", "description": "Confirmar limpieza del area"},
        ],
    }, token=token), 200)
    assert template["name"] == f"Smoke {stamp}"
    assert [task["name"] for task in template["tasks"]] == ["Revisar caja", "Revisar piso"]
    assert template["tasks"][0]["description"] == "Contar efectivo de apertura"

    updated = _ok(*_call("PUT", f"/api/assignment-templates/{template['id']}", {
        "name": f"Smoke {stamp}",
        "state": "active",
        "active": True,
        "tasks": [
            {"name": "Apertura", "description": "Encender luces y equipos"},
        ],
    }, token=token))
    assert len(updated["tasks"]) == 1
    assert updated["tasks"][0]["name"] == "Apertura"

    employee = _ok(*_call("POST", "/api/employees", {
        "name": f"Smoke User {stamp}",
        "user_pin": pin,
        "task_template_ids": [template["id"]],
    }, token=token))
    assert employee["id"]
    ledger = _ok(*_call("GET", f"/api/employees/{employee['id']}/ledger", token=token))
    assert "entries" in ledger

    time.sleep(3.1)
    identified = _ok(*_call("POST", "/api/kiosk/identify-pin", {"device_code": "KIOSK-DEMO", "pin": pin}))
    assert identified["employee"]["id"] == employee["id"]
    assert identified["access_token"]
    assert identified["employee"].get("has_face_template") is False
    kiosk_token = identified["access_token"]
    verify = _ok(*_call("POST", "/api/kiosk/verify-face", {
        "image_base64": "invalid-image",
        "device_code": "KIOSK-DEMO",
    }, token=kiosk_token))
    assert verify["success"] is False
    assert verify["employee_id"] == employee["id"]

    events = _ok(*_call("GET", f"/api/kiosk/employees/{employee['id']}/available-events?device_code=KIOSK-DEMO", token=kiosk_token))
    assert events, "No hay tipos de evento disponibles para check-in"
    shift_in = next(item for item in events if item["code"] == "shift_in")
    work_status = _ok(*_call("GET", f"/api/kiosk/employees/{employee['id']}/work-status", token=kiosk_token))
    assert "label" in work_status
    calendar = _ok(*_call("GET", f"/api/employees/{employee['id']}/task-calendar", token=token))
    assert calendar["days"]
    event_payload = {
        "employee_id": employee["id"],
        "event_type_id": shift_in["id"],
        "device_code": "KIOSK-DEMO",
        "method": "pin",
    }
    status, created_event = _call("POST", "/api/kiosk/attendance-events", event_payload, token=kiosk_token)
    if status == 409:
        event_payload["manager_pin"] = "1234"
        created_event = _ok(*_call("POST", "/api/kiosk/attendance-events", event_payload, token=kiosk_token))
    else:
        created_event = _ok(status, created_event)
    assert created_event["employee_id"] == employee["id"]

    pending = _ok(*_call("GET", f"/api/kiosk/employees/{employee['id']}/assignments", token=kiosk_token))
    assert pending, "La plantilla no se asigno al empleado"
    assignment = pending[0]
    assert assignment["template_name"] == f"Smoke {stamp}"
    assert assignment["tasks"], "La seccion no trae tareas"
    assert assignment["tasks"][0]["name"] == "Apertura"
    assert assignment["tasks"][0]["description"] == "Encender luces y equipos"
    assert assignment["tasks"][0]["completed"] is False
    toggled = None
    for task in assignment["tasks"]:
        toggled = _ok(*_call(
            "POST",
            f"/api/kiosk/employee-assignments/{assignment['id']}/tasks/{task['id']}",
            {"completed": True},
            token=kiosk_token,
        ))
        assert toggled["tasks"]
    assert toggled["state"] in {"completed", "validated"}
    remaining = _ok(*_call("GET", f"/api/kiosk/employees/{employee['id']}/assignments", token=kiosk_token))
    assert all(item["id"] != assignment["id"] for item in remaining)

    other_pin = str(2000 + (int(stamp[4:8], 16) % 7000))
    other = _ok(*_call("POST", "/api/employees", {
        "name": f"Smoke Other {stamp}",
        "user_pin": other_pin,
    }, token=token))
    forbidden_status, _ = _call("GET", f"/api/kiosk/employees/{other['id']}/assignments", token=kiosk_token)
    assert forbidden_status == 403
    forbidden_event_status, _ = _call("GET", f"/api/kiosk/employees/{other['id']}/available-events?device_code=KIOSK-DEMO", token=kiosk_token)
    assert forbidden_event_status == 403

    overview = _ok(*_call("GET", "/api/work-schedules/overview", token=token))
    assert overview["schedules"]
    assert overview["default_schedule_id"]
    created_schedule = _ok(*_call("POST", "/api/work-schedules", {
        "name": f"Turno manana {stamp}",
        "description": "08:00 a 16:00",
        "lines": [
            {"weekday": day, "start_time": "08:00", "end_time": "16:00", "is_off": day >= 5, "overnight": False}
            for day in range(7)
        ],
    }, token=token))
    assigned = _ok(*_call("PUT", f"/api/work-schedules/employees/{employee['id']}", {
        "schedule_id": created_schedule["id"],
    }, token=token))
    assert assigned["source"] == "employee"
    assert assigned["resolved_schedule_id"] == created_schedule["id"]

    face = _ok(*_call("POST", "/api/kiosk/identify-face", {
        "image_base64": "invalid-image",
        "device_code": "KIOSK-DEMO",
    }))
    assert face["success"] is False
    assert not face.get("access_token")
    calendar = _ok(*_call("GET", "/api/reports/calendar", token=token))
    assert calendar["days"]

    _ok(*_call("POST", "/api/kiosk/identify-pin", {"device_code": "KIOSK-DEMO", "pin": "0000"}), 401)
    too_soon_status, too_soon = _call("POST", "/api/kiosk/identify-pin", {"device_code": "KIOSK-DEMO", "pin": "0000"})
    assert too_soon_status == 400, too_soon
    assert "demasiados" not in str(too_soon).lower()

    archived = _ok(*_call("POST", f"/api/assignment-templates/{template['id']}/archive", {}, token=token))
    assert archived["active"] is False
    _ok(*_call("POST", "/api/auth/logout", {}, token=token))
