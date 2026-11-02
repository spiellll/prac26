"""The existing React diary keeps working against the Python service."""

import json
from uuid import uuid4

from sqlalchemy import text

from ritm_api.models import db


def test_empty_local_diary_keeps_original_context_without_writing_a_profile(app, client):
    with app.app_context():
        assert db.session.execute(text("SELECT COUNT(*) FROM profiles")).scalar_one() == 0
    diary = client.get("/api/diary").get_json()
    assert diary["publicDemo"] is False
    assert diary["entries"] == []
    profile = diary["profile"]
    assert profile["goal"] == "Просушиться и привести себя в форму"
    assert profile["experience"] == "Раньше занимался армрестлингом, сейчас не занимаюсь."
    assert profile["preferences"] == "Люблю долгую фитнес-разминку всего тела перед основной тренировкой."
    assert client.get("/api/v1/profile").get_json()["profile"] == profile
    with app.app_context():
        assert db.session.execute(text("SELECT COUNT(*) FROM profiles")).scalar_one() == 0


def test_health_profile_and_stats(client, entry_factory):
    health = client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.get_json()["status"] == "ok"
    profile = client.get("/api/v1/profile").get_json()["profile"]
    profile.update(name="Афанасий", frequency=3)
    response = client.put("/api/v1/profile", json=profile)
    assert response.status_code == 200
    assert response.get_json()["profile"]["name"] == "Афанасий"
    assert client.get("/api/diary").get_json()["profile"]["frequency"] == 3
    assert client.put("/api/v1/profile", json={**profile, "frequency": 0}).status_code == 400

    client.post("/api/v1/entries", json=entry_factory(cycleIndex=1))
    client.post("/api/v1/entries", json=entry_factory(kind="weight", exercises=[], cycleIndex=None, value=81))
    stats = client.get("/api/v1/stats").get_json()
    assert stats["entries"] == 2
    assert stats["totalWorkouts"] == 1
    assert stats["byKind"]["weight"] == 1
    assert stats["nextCycle"] == 2


def test_compatibility_save_update_delete_restore(client, entry_factory):
    payload = entry_factory()
    response = client.post("/api/diary", json={"action": "saveEntry", "entry": payload})
    assert response.status_code == 200
    payload["text"] = "Дополнение к тренировке"
    assert client.post("/api/diary", json={"action": "saveEntry", "entry": payload}).status_code == 200
    diary = client.get("/api/diary").get_json()
    assert diary["advice"] is None
    assert diary["aiAvailable"] is False
    assert len(diary["entries"]) == 1
    assert diary["entries"][0]["text"] == payload["text"]
    assert client.post("/api/diary", json={"action": "deleteEntry", "id": payload["id"]}).status_code == 200
    assert client.get("/api/diary").get_json()["entries"] == []
    assert client.post("/api/diary", json={"action": "restoreEntry", "id": payload["id"]}).status_code == 200
    assert len(client.get("/api/diary").get_json()["entries"]) == 1


def test_legacy_sqlite_exercises_are_normalized_without_rewriting(app, client, entry_factory):
    legacy = entry_factory(exercises=[{
        "name": "Бицепс", "group": "biceps", "sets": 2, "reps": 10, "weight": 12,
    }])
    raw = json.dumps(legacy, ensure_ascii=False)
    with app.app_context():
        db.session.execute(text(
            "INSERT INTO entries (id, user_id, date, data, created_at) "
            "VALUES (:id, :user_id, :date, :data, :created_at)"
        ), {"id": legacy["id"], "user_id": "local_seedy", "date": legacy["date"], "data": raw, "created_at": legacy["createdAt"]})
        db.session.commit()
    exercise = client.get("/api/diary").get_json()["entries"][0]["exercises"][0]
    assert exercise["groups"] == ["biceps"]
    assert len(exercise["sets"]) == 2
    assert exercise["sets"][0] == {"reps": 10, "weight": 12, "effort": None, "warmup": False}
    with app.app_context():
        assert db.session.execute(text("SELECT data FROM entries WHERE id=:id"), {"id": legacy["id"]}).scalar_one() == raw


def test_legacy_save_is_normalized(client, entry_factory):
    payload = entry_factory(exercises=[{
        "name": "Бицепс", "group": "biceps", "sets": 2, "reps": 10, "weight": 12,
    }])
    response = client.post("/api/diary", json={"action": "saveEntry", "entry": payload})
    assert response.status_code == 200
    exercise = client.get("/api/diary").get_json()["entries"][0]["exercises"][0]
    assert exercise["groups"] == ["biceps"]
    assert len(exercise["sets"]) == 2


def test_chat_persists_weight_and_retry_does_not_duplicate(client):
    request = {"action": "chat", "id": str(uuid4()), "date": "2026-06-02", "topic": "weight", "text": "81,5 кг", "question": "Какой вес сегодня?"}
    response = client.post("/api/diary", json=request)
    assert response.status_code == 200
    answer = response.get_json()
    assert answer["entryId"] == request["id"]
    assert answer["mode"] == "questions"
    assert answer["reply"]
    assert isinstance(answer["draft"], list)
    retry = client.post("/api/diary", json=request)
    assert retry.status_code == 200
    assert retry.get_json()["reply"] == answer["reply"]
    diary = client.get("/api/diary").get_json()
    assert len(diary["entries"]) == 1
    assert diary["entries"][0]["kind"] == "weight"
    assert diary["entries"][0]["value"] == 81.5
    assert len(diary["messages"]) == 2
    assert [message["role"] for message in diary["messages"]] == ["user", "assistant"]
    messages = client.get("/api/v1/messages?per_page=1").get_json()
    assert messages["total"] == 2
    assert len(messages["items"]) == 1


def test_chat_sleep_and_note_keep_their_meaning(client):
    for topic, value in [("sleep", "7,5 ч"), ("note", "На этой неделе спокойно")]:
        response = client.post("/api/diary", json={"action": "chat", "id": str(uuid4()), "date": "2026-06-02", "topic": topic, "text": value, "question": ""})
        assert response.status_code == 200
    entries = client.get("/api/diary").get_json()["entries"]
    sleep = next(item for item in entries if item["kind"] == "sleep")
    note = next(item for item in entries if item["kind"] == "note")
    assert sleep["value"] == 7.5
    assert note["text"] == "На этой неделе спокойно"


def test_local_report_requires_no_external_ai(client):
    response = client.post("/api/diary", json={"action": "report", "date": "2026-06-02"})
    assert response.status_code == 200
    assert response.get_json()["reply"]
    assert client.post("/api/diary", json={"action": "checkAI"}).status_code == 410


def test_cross_origin_mutation_is_rejected(client, entry_factory):
    response = client.post("/api/diary", json={"action": "saveEntry", "entry": entry_factory()}, headers={"Origin": "https://foreign.invalid"})
    assert response.status_code == 403
    assert client.get("/api/diary").get_json()["entries"] == []


def test_explicit_origin_allowlist_permits_the_frontend(app, client, entry_factory):
    app.config["RITM_ALLOWED_ORIGINS"] = ["https://diary.example.test"]
    response = client.post("/api/diary", json={"action": "saveEntry", "entry": entry_factory()}, headers={"Origin": "https://diary.example.test"})
    assert response.status_code == 200
    assert len(client.get("/api/diary").get_json()["entries"]) == 1


def test_wrong_action_type_is_a_bad_request(client):
    response = client.post("/api/diary", json={"action": []})
    assert response.status_code == 400
    assert response.get_json()["error"]


def test_profile_context_can_be_cleared(client):
    profile = client.get("/api/v1/profile").get_json()["profile"]
    profile.update(experience="Раньше занимался армрестлингом", preferences="Долгая разминка")
    assert client.put("/api/v1/profile", json=profile).status_code == 200
    profile.update(experience="", preferences="")
    response = client.put("/api/v1/profile", json=profile)
    assert response.status_code == 200
    assert response.get_json()["profile"]["experience"] == ""
    assert response.get_json()["profile"]["preferences"] == ""
    saved = client.get("/api/diary").get_json()["profile"]
    assert saved["experience"] == saved["preferences"] == ""
