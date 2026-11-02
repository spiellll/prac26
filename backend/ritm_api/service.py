"""Diary operations shared by REST resources and the existing React client."""
import json
import re
from collections import Counter
from datetime import date, datetime, timedelta

from flask import abort, current_app, session
from sqlalchemy import func, select

from .models import AdviceRecord, EntryRecord, MessageRecord, Profile, db
from .validation import (
    KIND_NAMES, InvalidData, canonical_name, day_value, exercise_key, normalize_entry,
    normalize_profile, object_value, text_value, utc_now, uuid_value, validate_entry, validate_profile,
)


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def user_id():
    if not current_app.config["PUBLIC_DEMO"]:
        return "local_seedy"
    from uuid import uuid4
    if not isinstance(session.get("diary_user"), str) or not re.fullmatch(r"demo_[0-9a-f-]{36}", session["diary_user"]):
        session["diary_user"] = "demo_" + str(uuid4())
        session.permanent = True
    return session["diary_user"]


def profile_for(uid):
    row = db.session.get(Profile, uid)
    return normalize_profile(json.loads(row.data) if row else {}, local=uid == "local_seedy")


def ensure_profile(uid):
    row = db.session.get(Profile, uid)
    if row is None:
        row = Profile(user_id=uid, data=encode(normalize_profile({}, local=uid == "local_seedy")), updated_at=utc_now())
        db.session.add(row)
    return row


def save_profile(uid, raw):
    profile = validate_profile(raw, local=uid == "local_seedy")
    row = ensure_profile(uid)
    row.data = encode(profile)
    row.updated_at = utc_now()
    db.session.commit()
    return profile


def active_entries(uid):
    return select(EntryRecord).where(EntryRecord.user_id == uid, EntryRecord.deleted_at.is_(None))


def entry_json(row):
    return normalize_entry(json.loads(row.data))


def entries_for(uid):
    return [entry_json(row) for row in db.session.scalars(active_entries(uid).order_by(EntryRecord.date.desc(), EntryRecord.created_at.desc(), EntryRecord.id))]


def message_json(row):
    return {"id": row.id, "role": row.role, "text": row.text, "createdAt": row.created_at}


def diary_for(uid):
    messages = list(db.session.scalars(select(MessageRecord).where(MessageRecord.user_id == uid).order_by(MessageRecord.created_at.desc(), MessageRecord.id.desc()).limit(100)))
    # Historical generated advice is intentionally not returned: this version has
    # local observations and sends no diary data to a model provider.
    return {"profile": profile_for(uid), "entries": entries_for(uid), "messages": [message_json(row) for row in reversed(messages)], "advice": None, "aiAvailable": False, "publicDemo": current_app.config["PUBLIC_DEMO"]}


def require_entry(uid, identifier, *, include_deleted=False):
    uuid_value(identifier)
    statement = select(EntryRecord).where(EntryRecord.id == identifier, EntryRecord.user_id == uid)
    if not include_deleted:
        statement = statement.where(EntryRecord.deleted_at.is_(None))
    row = db.session.scalar(statement)
    if row is None:
        abort(404, description="Запись не найдена.")
    return row


def save_entry(uid, raw, *, create_only=False, defaults=False):
    entry = validate_entry(raw, defaults=defaults)
    row = db.session.get(EntryRecord, entry["id"])
    if row is not None and (row.user_id != uid or row.deleted_at is not None or create_only):
        abort(409, description="Этот идентификатор уже занят. Используй новую запись или восстанови удалённую.")
    catalog = {}
    for old in entries_for(uid):
        if old["kind"] == "workout":
            for exercise in old["exercises"]:
                catalog.setdefault(exercise_key(exercise["name"]), canonical_name(exercise["name"]))
    for exercise in entry["exercises"]:
        exercise["name"] = catalog.get(exercise_key(exercise["name"]), canonical_name(exercise["name"]))
    ensure_profile(uid)
    if row is None:
        row = EntryRecord(id=entry["id"], user_id=uid, created_at=entry["createdAt"])
        db.session.add(row)
    else:
        # Keep the original creation timestamp stable when a request is retried.
        entry["createdAt"] = row.created_at
    row.date = entry["date"]
    row.data = encode(entry)
    db.session.commit()
    return entry


def delete_entry(uid, identifier):
    row = require_entry(uid, identifier, include_deleted=True)
    if row.deleted_at is None:
        row.deleted_at = utc_now()
        db.session.commit()


def restore_entry(uid, identifier):
    row = require_entry(uid, identifier, include_deleted=True)
    row.deleted_at = None
    db.session.commit()
    return entry_json(row)


EXERCISE_PATTERNS = [
    (r"станов[а-я]*\s*(?:тяга)?", "Становая тяга", "back"),
    (r"присед", "Приседания", "legs"), (r"жим ног", "Жим ногами", "legs"),
    (r"выпад", "Выпады", "legs"), (r"разгибан.*ног", "Разгибание ног", "legs"),
    (r"сгибан.*ног", "Сгибание ног", "legs"), (r"подтяг", "Подтягивания", "back"),
    (r"верхн.*блок|вертикальн.*тяг", "Тяга верхнего блока", "back"),
    (r"тяг.*наклон|горизонтальн.*тяг|нижн.*блок", "Тяга в наклоне", "back"),
    (r"брус", "Брусья", "chest"), (r"жим.*л[её]жа|жим штанг", "Жим лёжа", "chest"),
    (r"отжим", "Отжимания", "chest"), (r"жим гант", "Жим гантелей", "chest"),
    (r"жим.*стоя|жим.*голов|армейск.*жим", "Жим над головой", "shoulders"),
    (r"мах|разведен.*сторон", "Махи в стороны", "shoulders"),
    (r"предплеч.*штанг", "Предплечья со штангой", "forearms"),
    (r"предплеч.*гантел", "Предплечья с гантелью", "forearms"),
    (r"бицепс", "Сгибания на бицепс", "biceps"), (r"трицепс", "Разгибания на трицепс", "arms"),
    (r"ягодич|мост", "Ягодичный мост", "glutes"), (r"носк|икр", "Подъём на носки", "calves"),
    (r"скручив|пресс", "Скручивания", "core"),
]


def parse_exercises(text):
    """Conservative draft recognition; a draft never adds a saved workout."""
    result = []
    for part in re.split(r"[\n;]+|,\s*(?=[а-яёa-z])", text, flags=re.IGNORECASE):
        matched = next(((name, group) for pattern, name, group in EXERCISE_PATTERNS if re.search(pattern, part, re.IGNORECASE)), None)
        numbers = re.search(r"(\d{1,2})\s*[xх×*]\s*(\d{1,3})", part, re.IGNORECASE) or re.search(r"(\d{1,2})\s*(?:подход\w*\s*)?по\s*(\d{1,3})", part, re.IGNORECASE)
        if not matched or not numbers:
            continue
        count, reps = map(int, numbers.groups())
        if not 1 <= count <= 30 or not 1 <= reps <= 200:
            continue
        weight = re.search(r"(\d{1,3}(?:[.,]\d+)?)\s*кг", part, re.IGNORECASE)
        # Guard against a partial match on a four-digit or negative weight.
        if weight and weight.start() and (part[weight.start() - 1].isdigit() or part[weight.start() - 1] == "-"):
            continue
        kilograms = float(weight.group(1).replace(",", ".")) if weight else 0
        if kilograms > 600:
            continue
        end = min(numbers.start(), weight.start() if weight else numbers.start())
        raw_name = re.sub(r"[—–:,-]+$", "", part[:end]).strip()
        name = canonical_name(raw_name or matched[0])
        key = exercise_key(name)
        groups = ["back", "legs", "glutes", "strength"] if key == "становая тяга" else ["legs", "glutes", "strength"] if key == "приседания" else [matched[1]]
        result.append({"name": name, "groups": groups, "sets": [{"reps": reps, "weight": kilograms, "warmup": bool(re.search("размин", part, re.IGNORECASE)), "effort": None} for _ in range(count)]})
    return result


FOLLOW_UP = {
    "workout": ["Какие ощущения были после тренировки? Что далось легко, а что тяжело?", "Сколько длилась разминка и основная часть?", "Что хочешь изменить в следующей тренировке?"],
    "weight": ["В какое время и при каких условиях взвешивался?", "Что ещё хочешь отметить о сегодняшнем дне?"],
    "sleep": ["Насколько выспался? Как это сказалось на энергии?", "Что могло повлиять на качество сна?"],
    "nutrition": ["Как менялись голод и сытость в течение дня?", "Что было удобно в сегодняшнем питании, а что хотелось бы изменить?"],
    "feeling": ["Что сегодня могло повлиять на твоё самочувствие?", "Что помогло бы сделать следующую тренировку комфортнее?"],
    "note": ["Как это связано с твоими тренировками или повседневным ритмом?", "Что ещё важно учесть? Можно продолжить мысль или выбрать новую тему.", "Есть ли привычка, которую хочешь сохранить или изменить?"],
}


def chat(uid, raw):
    raw = object_value(raw)
    identifier = uuid_value(raw.get("id"))
    topic = raw.get("topic")
    if not isinstance(topic, str) or topic not in FOLLOW_UP:
        raise InvalidData("Выбери тему из списка.")
    text = text_value(raw.get("text"), "Ответ", 6000, 1).strip()
    question = text_value(raw.get("question", ""), "Вопрос", 5000)
    day = day_value(raw.get("date"))
    reply_row = db.session.get(MessageRecord, identifier + "-reply")
    if reply_row is not None:
        if reply_row.user_id != uid:
            abort(409, description="Этот идентификатор уже занят.")
        original = db.session.get(MessageRecord, identifier + "-user")
        stored = db.session.get(EntryRecord, identifier)
        if stored is None or stored.user_id != uid or stored.deleted_at is not None:
            abort(409, description="Запись уже удалена. Начни новый ответ.")
        entry = entry_json(stored)
        draft = parse_exercises(original.text) if original else []
        return {"reply": reply_row.text, "duplicate": True, "draft": draft if entry["title"] == KIND_NAMES["workout"] else [], "mode": "questions", "entryId": identifier}
    # UUIDs are global primary keys in the legacy schema. Never overwrite another
    # visitor's entry, including entries created through REST with the same id.
    if db.session.get(EntryRecord, identifier) is not None or db.session.get(MessageRecord, identifier + "-user") is not None:
        abort(409, description="Этот идентификатор уже занят.")
    count = db.session.scalar(select(func.count()).select_from(MessageRecord).where(MessageRecord.user_id == uid, MessageRecord.role == "user"))
    reply = "Записал. " + ("В каких движениях или обстоятельствах возникает дискомфорт? Сохраним это как контекст, без попытки поставить диагноз." if re.search(r"бол[ьи]|травм|дискомфорт", text, re.IGNORECASE) else FOLLOW_UP[topic][count % len(FOLLOW_UP[topic])])
    value = None
    number = re.fullmatch(r"(\d{1,3}(?:[.,]\d+)?)\s*(?:кг|час(?:а|ов)?|ч)?", text, re.IGNORECASE)
    if number:
        value = float(number.group(1).replace(",", "."))
    kind = "weight" if topic == "weight" and value is not None and 20 <= value <= 400 else "sleep" if topic == "sleep" and value is not None and 0 <= value <= 24 else topic if topic in {"nutrition", "feeling"} else "note"
    stamp = utc_now()
    reply_stamp = (datetime.fromisoformat(stamp.replace("Z", "+00:00")) + timedelta(milliseconds=1)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    entry = validate_entry({"id": identifier, "date": day, "kind": kind, "title": KIND_NAMES[topic], "text": (f"Вопрос: {question}\n\n" if question else "") + text, "exercises": [], "value": value if kind in {"weight", "sleep"} else None, "cycleIndex": None, "createdAt": stamp})
    ensure_profile(uid)
    db.session.add(EntryRecord(id=identifier, user_id=uid, date=day, data=encode(entry), created_at=stamp))
    db.session.add_all([
        MessageRecord(id=identifier + "-user", user_id=uid, role="user", text=text, created_at=stamp),
        MessageRecord(id=identifier + "-reply", user_id=uid, role="assistant", text=reply, created_at=reply_stamp),
    ])
    db.session.commit()
    return {"reply": reply, "mode": "questions", "warning": "", "draft": parse_exercises(text) if topic == "workout" else [], "entryId": identifier}


def next_cycle(entries, profile, day):
    latest = next((row for row in entries if row["kind"] == "workout" and row.get("cycleIndex") is not None and row["date"] <= day), None)
    return (latest["cycleIndex"] + 1) % len(profile["cycle"]) if latest else 0


def report(uid, day):
    day = day_value(day)
    entries = entries_for(uid)
    profile = profile_for(uid)
    workouts = [entry for entry in entries if entry["kind"] == "workout" and entry["date"] <= day]
    if not workouts:
        return "Сначала добавь хотя бы одну тренировку. Тогда появится обзор записей и последовательности твоего цикла."
    last = workouts[0]
    gap = (date.fromisoformat(day) - date.fromisoformat(last["date"])).days
    recent = [entry for entry in workouts if (date.fromisoformat(day) - date.fromisoformat(entry["date"])).days < 30]
    groups = Counter(group for entry in recent for exercise in entry["exercises"] for group in exercise["groups"] for item in exercise["sets"] if not item["warmup"])
    names = {"chest": "грудь", "back": "спина", "shoulders": "плечи", "arms": "руки", "biceps": "бицепс", "forearms": "предплечья", "legs": "ноги", "glutes": "ягодицы", "core": "пресс", "calves": "икры", "strength": "сила"}
    parts = [f"За последние 30 дней записано тренировок: {len(recent)}. Последняя тренировка: {last['date']}, {gap} дн. назад.", f"Следующая в твоём цикле: «{profile['cycle'][next_cycle(entries, profile, day)]}»."]
    if groups:
        parts.append("Чаще всего отмечались рабочие подходы: " + ", ".join(f"{names[group]} — {count}" for group, count in groups.most_common(2)) + ".")
    parts.append("Это обзор записей, а не оценка восстановления. Как чувствуешь себя сегодня?")
    return "\n\n".join(parts)
