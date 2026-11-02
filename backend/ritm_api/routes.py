"""Resource-oriented REST API and a compatibility adapter for the diary UI."""
from datetime import date

from flask import Blueprint, abort, current_app, jsonify, request
from sqlalchemy import JSON, cast, func, select

from .models import EntryRecord, MessageRecord, Profile, db
from .service import (
    active_entries, chat, delete_entry, diary_for, entries_for, entry_json,
    message_json, next_cycle, profile_for, report, require_entry, restore_entry,
    save_entry, save_profile, user_id,
)
from .validation import KINDS, InvalidData, day_value, object_value, uuid_value

api = Blueprint("api", __name__)


def body():
    if not request.is_json:
        raise InvalidData("Укажи заголовок Content-Type: application/json.")
    return object_value(request.get_json())


def positive_int(raw, name, maximum):
    if not isinstance(raw, str) or not raw.isdecimal() or not 1 <= int(raw) <= maximum:
        raise InvalidData(f"{name}: целое число от 1 до {maximum}.")
    return int(raw)


def paging():
    return positive_int(request.args.get("page", "1"), "page", 1_000_000), positive_int(request.args.get("per_page", "20"), "per_page", 100)


def paginate(statement, serializer):
    page, per_page = paging()
    total = db.session.scalar(select(func.count()).select_from(statement.order_by(None).subquery()))
    rows = db.session.scalars(statement.offset((page - 1) * per_page).limit(per_page))
    return {"items": [serializer(row) for row in rows], "page": page, "per_page": per_page, "total": total, "pages": (total + per_page - 1) // per_page}


def kind_expression():
    if db.engine.dialect.name == "sqlite":
        return func.json_extract(EntryRecord.data, "$.kind")
    return cast(EntryRecord.data, JSON)["kind"].as_string()


@api.get("/api/v1/health")
def health():
    db.session.execute(select(1))
    return jsonify({"status": "ok", "service": "ritm-api", "storage": db.engine.dialect.name, "aiAvailable": False})


@api.get("/api/v1/entries")
def list_entries():
    statement = active_entries(user_id())
    kind = request.args.get("kind")
    if kind is not None:
        if kind not in KINDS:
            raise InvalidData("Неизвестный тип записи.")
        statement = statement.where(kind_expression() == kind)
    after = request.args.get("from", request.args.get("date_from"))
    before = request.args.get("to", request.args.get("date_to"))
    if after is not None:
        statement = statement.where(EntryRecord.date >= day_value(after, "Начало периода"))
    if before is not None:
        statement = statement.where(EntryRecord.date <= day_value(before, "Конец периода"))
    if after is not None and before is not None and after > before:
        raise InvalidData("Начало периода позже его конца.")
    q = request.args.get("q", "").strip()
    if len(q) > 200:
        raise InvalidData("Поисковый запрос: не более 200 символов.")
    if q:
        text = func.ritm_casefold(EntryRecord.data) if db.engine.dialect.name == "sqlite" else func.lower(EntryRecord.data)
        statement = statement.where(text.contains(q.casefold(), autoescape=True))
    return jsonify(paginate(statement.order_by(EntryRecord.date.desc(), EntryRecord.created_at.desc(), EntryRecord.id), entry_json))


@api.post("/api/v1/entries")
def create_entry():
    entry = save_entry(user_id(), body(), create_only=True, defaults=True)
    response = jsonify({"entry": entry})
    response.status_code = 201
    response.headers["Location"] = "/api/v1/entries/" + entry["id"]
    return response


@api.get("/api/v1/entries/<identifier>")
def get_entry(identifier):
    return jsonify({"entry": entry_json(require_entry(user_id(), identifier))})


@api.patch("/api/v1/entries/<identifier>")
def patch_entry(identifier):
    uid = user_id()
    row = require_entry(uid, identifier)
    changes = body()
    if "id" in changes and changes["id"] != identifier:
        raise InvalidData("Нельзя изменить идентификатор записи.")
    if "createdAt" in changes and changes["createdAt"] != row.created_at:
        raise InvalidData("Нельзя изменить дату создания записи.")
    merged = {**entry_json(row), **changes, "id": identifier, "createdAt": row.created_at}
    return jsonify({"entry": save_entry(uid, merged)})


@api.delete("/api/v1/entries/<identifier>")
def remove_entry(identifier):
    delete_entry(user_id(), identifier)
    return "", 204


@api.post("/api/v1/entries/<identifier>/restore")
def undelete_entry(identifier):
    return jsonify({"entry": restore_entry(user_id(), identifier)})


@api.get("/api/v1/profile")
def get_profile():
    return jsonify({"profile": profile_for(user_id())})


@api.put("/api/v1/profile")
def put_profile():
    raw = body()
    return jsonify({"profile": save_profile(user_id(), raw.get("profile", raw))})


@api.get("/api/v1/messages")
def get_messages():
    statement = select(MessageRecord).where(MessageRecord.user_id == user_id()).order_by(MessageRecord.created_at.desc(), MessageRecord.id.desc())
    return jsonify(paginate(statement, message_json))


@api.get("/api/v1/stats")
def get_stats():
    uid = user_id()
    # An actual ORM LEFT JOIN demonstrates the relation between the profile and
    # its records and still includes legacy entries without a profile row.
    kind = kind_expression()
    grouped = db.session.execute(
        select(kind.label("kind"), func.count(EntryRecord.id).label("count"))
        .select_from(EntryRecord).outerjoin(EntryRecord.profile)
        .where(EntryRecord.user_id == uid, EntryRecord.deleted_at.is_(None))
        .group_by(kind)
    ).all()
    counts = {row.kind: row.count for row in grouped}
    profile = profile_for(uid)
    entries = entries_for(uid)
    return jsonify({"entries": sum(counts.values()), "totalWorkouts": counts.get("workout", 0), "byKind": counts, "nextCycle": next_cycle(entries, profile, date.today().isoformat()), "profileName": profile["name"]})


@api.get("/api/diary")
def get_diary():
    return jsonify(diary_for(user_id()))


@api.post("/api/diary")
def diary_action():
    raw = body()
    action = raw.get("action")
    if not isinstance(action, str):
        raise InvalidData("Укажи действие дневника строкой.")
    uid = user_id()
    if action == "saveEntry":
        save_entry(uid, raw.get("entry"))
        return jsonify({"ok": True})
    if action == "saveProfile":
        save_profile(uid, raw.get("profile"))
        return jsonify({"ok": True})
    if action == "deleteEntry":
        delete_entry(uid, uuid_value(raw.get("id")))
        return jsonify({"ok": True})
    if action == "restoreEntry":
        restore_entry(uid, uuid_value(raw.get("id")))
        return jsonify({"ok": True})
    if action == "chat":
        return jsonify(chat(uid, raw))
    if action == "report":
        return jsonify({"reply": report(uid, raw.get("date"))})
    if action in {"checkAI", "advice"}:
        return jsonify({"error": "В этой версии используются локальные наблюдения без обращения к ИИ."}), 410
    raise InvalidData("Неизвестное действие дневника.")
