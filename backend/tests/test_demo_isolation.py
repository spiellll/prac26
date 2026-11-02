"""A public demonstration must never share a visitor's mutable diary."""

import pytest

from ritm_api import create_app
from ritm_api.models import db


@pytest.fixture
def demo_app(tmp_path):
    application = create_app({
        "TESTING": True, "PUBLIC_DEMO": True,
        "SECRET_KEY": "pytest-signed-demo-session-key",
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'demo.sqlite'}",
        "RITM_DB_FILE": str(tmp_path / "demo.sqlite"),
    })
    yield application
    with application.app_context():
        db.session.remove()
        db.engine.dispose()


def test_demo_visitors_cannot_read_or_overwrite_each_others_diary(demo_app, entry_factory):
    alice = demo_app.test_client()
    bob = demo_app.test_client()
    initial_alice = alice.get("/api/diary").get_json()
    initial_bob = bob.get("/api/diary").get_json()
    assert initial_alice["entries"] == []
    assert initial_bob["entries"] == []
    payload = entry_factory(text="Запись посетителя А")
    assert alice.post("/api/v1/entries", json=payload).status_code == 201
    assert len(alice.get("/api/diary").get_json()["entries"]) == 1
    assert bob.get("/api/diary").get_json()["entries"] == []
    assert bob.patch(f"/api/v1/entries/{payload['id']}", json={"text": "Подмена"}).status_code in (404, 409)
    assert bob.delete(f"/api/v1/entries/{payload['id']}").status_code in (404, 409)
    assert bob.post("/api/v1/entries", json=payload).status_code == 409
    assert bob.post("/api/diary", json={"action": "saveEntry", "entry": payload}).status_code == 409
    assert alice.get("/api/diary").get_json()["entries"][0]["text"] == payload["text"]


def test_public_demo_starts_with_generic_context(demo_app):
    diary = demo_app.test_client().get("/api/diary").get_json()
    assert diary["publicDemo"] is True
    assert diary["profile"]["name"] == ""
    assert diary["profile"]["goal"] == "Привести себя в форму"
    assert diary["profile"]["experience"] == ""
    assert diary["profile"]["preferences"] == ""


def test_demo_profile_changes_do_not_leak(demo_app):
    alice = demo_app.test_client()
    bob = demo_app.test_client()
    profile = alice.get("/api/v1/profile").get_json()["profile"]
    profile["name"] = "Имя только первого посетителя"
    assert alice.put("/api/v1/profile", json=profile).status_code == 200
    assert bob.get("/api/v1/profile").get_json()["profile"]["name"] != profile["name"]


def test_demo_personal_responses_are_never_shared_by_http_caches(demo_app):
    client = demo_app.test_client()
    for endpoint in ("/api/diary", "/api/v1/profile", "/api/v1/entries", "/api/v1/stats"):
        response = client.get(endpoint)
        assert response.status_code == 200
        assert response.cache_control.no_store
        assert response.cache_control.private
        assert "Cookie" in response.vary


def test_public_demo_refuses_an_unsigned_session(tmp_path, monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises((ValueError, RuntimeError)):
        create_app({
            "TESTING": True, "PUBLIC_DEMO": True, "SECRET_KEY": "",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'no-secret.sqlite'}",
        })
