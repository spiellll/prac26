"""CRUD, validation and filters at the HTTP boundary."""

from copy import deepcopy

import pytest


def create(client, entry):
    response = client.post("/api/v1/entries", json=entry)
    assert response.status_code == 201, response.get_json()
    return response.get_json()["entry"]


def test_entries_crud_and_soft_delete_are_retry_safe(client, entry_factory):
    payload = entry_factory()
    saved = create(client, payload)
    assert saved["id"] == payload["id"]
    assert saved["exercises"][0]["sets"][1]["weight"] == 15

    response = client.patch(f"/api/v1/entries/{saved['id']}", json={"text": "Вес добавлен аккуратно"})
    assert response.status_code == 200
    assert response.get_json()["entry"]["text"] == "Вес добавлен аккуратно"
    assert response.get_json()["entry"]["exercises"] == saved["exercises"]

    assert client.delete(f"/api/v1/entries/{saved['id']}").status_code == 204
    assert client.delete(f"/api/v1/entries/{saved['id']}").status_code == 204
    assert client.get("/api/v1/entries").get_json()["total"] == 0
    assert client.get("/api/diary").get_json()["entries"] == []

    response = client.post(f"/api/v1/entries/{saved['id']}/restore")
    assert response.status_code == 200
    assert response.get_json()["entry"]["text"] == "Вес добавлен аккуратно"
    assert client.post(f"/api/v1/entries/{saved['id']}/restore").status_code == 200
    assert client.get("/api/v1/entries").get_json()["total"] == 1


def test_duplicate_create_does_not_silently_replace_entry(client, entry_factory):
    payload = entry_factory()
    create(client, payload)
    payload["text"] = "Незапрошенная замена"
    response = client.post("/api/v1/entries", json=payload)
    assert response.status_code == 409
    assert client.get("/api/v1/entries").get_json()["items"][0]["text"] != payload["text"]


@pytest.mark.parametrize("field,value", [
    ("id", "not-a-uuid"),
    ("date", "2026-02-30"),
    ("date", "01.06.2026"),
    ("date", "2999-06-01"),
    ("kind", "unknown"),
    ("title", "   "),
    ("cycleIndex", 4),
    ("createdAt", "yesterday"),
])
def test_invalid_entry_fields_are_rejected_without_writes(client, entry_factory, field, value):
    response = client.post("/api/v1/entries", json=entry_factory(**{field: value}))
    assert response.status_code == 400
    assert response.get_json().get("error")
    assert client.get("/api/v1/entries").get_json()["total"] == 0


@pytest.mark.parametrize("field,value", [
    ("reps", 0), ("reps", 2.5), ("reps", True), ("reps", 201),
    ("weight", -1), ("weight", 601), ("weight", "20"),
    ("weight", float("nan")), ("weight", float("inf")), ("weight", 10 ** 1000),
    ("effort", "impossible"), ("warmup", "false"),
])
def test_invalid_workout_sets_are_rejected(client, entry_factory, field, value):
    payload = entry_factory()
    payload["exercises"][0]["sets"][0][field] = value
    assert client.post("/api/v1/entries", json=payload).status_code == 400


@pytest.mark.parametrize("groups", [["unlisted"], ["back", "back"], "back"])
def test_muscle_groups_are_a_distinct_known_list(client, entry_factory, groups):
    payload = entry_factory()
    payload["exercises"][0]["groups"] = groups
    assert client.post("/api/v1/entries", json=payload).status_code == 400


def test_activity_without_sets_and_unassigned_muscles_are_supported(client, entry_factory):
    payload = entry_factory(exercises=[{
        "name": "Разминка всего тела", "groups": [], "sets": [],
        "tracking": "activity", "notes": "15 минут",
    }])
    saved = create(client, payload)
    assert saved["exercises"][0]["sets"] == []
    bad = deepcopy(payload)
    bad["id"] = entry_factory()["id"]
    bad["exercises"][0]["sets"] = [{"reps": 8, "weight": 0, "effort": None, "warmup": False}]
    assert client.post("/api/v1/entries", json=bad).status_code == 400


def test_workout_content_cannot_be_attached_to_a_weight_entry(client, entry_factory):
    assert client.post("/api/v1/entries", json=entry_factory(kind="weight", value=81)).status_code == 400
    assert client.post("/api/v1/entries", json=entry_factory(exercises=[])).status_code == 400


@pytest.mark.parametrize("kind,value", [("weight", 19), ("weight", 401), ("weight", None), ("sleep", -1), ("sleep", 25)])
def test_body_weight_and_sleep_ranges(client, entry_factory, kind, value):
    payload = entry_factory(kind=kind, exercises=[], cycleIndex=None, value=value)
    assert client.post("/api/v1/entries", json=payload).status_code == 400


def test_filtering_pagination_and_order_work_together(client, entry_factory):
    for day, kind, text in [
        ("2026-06-01", "note", "План отдыха"),
        ("2026-06-02", "workout", "Тяга и спина"),
        ("2026-06-03", "workout", "Спина: добавил вес"),
        ("2026-06-04", "weight", "Утро"),
    ]:
        changes = {"date": day, "kind": kind, "text": text}
        if kind != "workout":
            changes.update(exercises=[], cycleIndex=None, value=81 if kind == "weight" else None)
        create(client, entry_factory(**changes))

    page = client.get("/api/v1/entries?kind=workout&q=спина&page=1&per_page=1").get_json()
    assert {key: page[key] for key in ("page", "per_page", "total", "pages")} == {
        "page": 1, "per_page": 1, "total": 2, "pages": 2,
    }
    assert page["items"][0]["date"] == "2026-06-03"
    second = client.get("/api/v1/entries?kind=workout&q=спина&page=2&per_page=1").get_json()
    assert second["items"][0]["date"] == "2026-06-02"
    by_date = client.get("/api/v1/entries?date_from=2026-06-02&date_to=2026-06-03").get_json()
    assert by_date["total"] == 2


@pytest.mark.parametrize("query", ["page=0", "page=no", "per_page=0", "kind=unknown", "date_from=2026-02-30"])
def test_invalid_filters_do_not_crash_or_silently_disappear(client, query):
    assert client.get(f"/api/v1/entries?{query}").status_code == 400


def test_invalid_json_and_nonexistent_resources_have_useful_status(client, entry_factory):
    assert client.post("/api/v1/entries", data="{broken", content_type="application/json").status_code == 400
    assert client.patch("/api/v1/entries/not-a-uuid", json={"text": "x"}).status_code == 400
    missing = entry_factory()["id"]
    assert client.patch(f"/api/v1/entries/{missing}", json={"text": "x"}).status_code == 404
    assert client.post(f"/api/v1/entries/{missing}/restore").status_code == 404


def test_oversized_request_returns_json_error_without_creating_records(client):
    response = client.post("/api/v1/entries", data=b" " * 150_001, content_type="application/json")
    assert response.status_code == 413
    assert response.get_json()["error"]
    assert client.get("/api/v1/entries").get_json()["total"] == 0


def test_nested_wrong_type_returns_validation_error(client, entry_factory):
    payload = entry_factory()
    payload["exercises"][0]["tracking"] = []
    response = client.post("/api/v1/entries", json=payload)
    assert response.status_code == 400
    assert response.get_json()["error"]
