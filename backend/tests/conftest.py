"""All tests use their own SQLite file; the personal diary is never opened."""

from copy import deepcopy
from uuid import uuid4

import pytest

from ritm_api import create_app
from ritm_api.models import db


@pytest.fixture
def app(tmp_path):
    application = create_app({
        "TESTING": True,
        "SECRET_KEY": "pytest-only-secret-key",
        "PUBLIC_DEMO": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'diary.sqlite'}",
        "RITM_DB_FILE": str(tmp_path / "diary.sqlite"),
    })
    yield application
    with application.app_context():
        db.session.remove()
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def entry_factory():
    def make_entry(**changes):
        entry = {
            "id": str(uuid4()),
            "date": "2026-06-01",
            "kind": "workout",
            "title": "Сила + руки",
            "text": "После разминки работал спокойно.",
            "exercises": [{
                "name": "Подтягивания с дополнительным весом",
                "groups": ["back", "biceps", "strength"],
                "sets": [
                    {"weight": 10, "reps": 8, "effort": "moderate", "warmup": False},
                    {"weight": 15, "reps": 6, "effort": "hard", "warmup": False},
                ],
            }],
            "value": None,
            "cycleIndex": 0,
            "createdAt": "2026-06-01T12:00:00.000Z",
        }
        entry.update(deepcopy(changes))
        return entry

    return make_entry
