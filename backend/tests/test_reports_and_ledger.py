from datetime import datetime

from app.services.operational_day import COMPLETED_TASK_STATES, KIND_LABELS


def test_completed_task_states_cover_finished_work():
    assert "completed" in COMPLETED_TASK_STATES
    assert "validated" in COMPLETED_TASK_STATES
    assert "pending" not in COMPLETED_TASK_STATES
    assert "validation_pending" not in COMPLETED_TASK_STATES


def test_ledger_kind_labels_are_plain_language():
    assert KIND_LABELS["attendance"] == "Asistencia"
    assert KIND_LABELS["task"] == "Tarea"
    assert KIND_LABELS["task_answer"] == "Respuesta"
    assert KIND_LABELS["audit"] == "Sistema"


def test_ledger_entries_sort_newest_first():
    entries = [
        {"at": datetime(2026, 8, 12, 18, 0), "title": "old"},
        {"at": datetime(2026, 8, 13, 2, 0), "title": "new"},
        {"at": datetime(2026, 8, 12, 20, 0), "title": "mid"},
    ]
    entries.sort(key=lambda item: item["at"], reverse=True)
    assert [item["title"] for item in entries] == ["new", "mid", "old"]
