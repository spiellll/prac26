"""Explicit JSON validation shared by the REST and legacy diary endpoints."""
import copy
import math
import re
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse
from uuid import UUID, uuid4

KINDS = {"workout", "weight", "sleep", "nutrition", "feeling", "note", "rest"}
GROUPS = {"chest", "back", "shoulders", "arms", "biceps", "forearms", "legs", "glutes", "core", "calves", "strength"}
EFFORTS = {"light", "moderate", "hard", "max"}
CYCLE = ["Сила + руки", "Спина", "Ноги и остальное", "Грудь, трицепс и плечи"]
LEGACY_CYCLE = ["Фитнес + ноги", "Брусья и подтягивания с весом", "Спина", "Грудь, плечи, руки"]
DEFAULT_PROFILE = {
    "name": "", "goal": "Привести себя в форму", "experience": "", "preferences": "",
    "frequency": 4, "cycle": CYCLE, "reminders": True, "gapDays": 3,
    "reminderTime": "18:00", "pausedUntil": "", "aiConsent": False, "chatgptUrl": "",
}
LOCAL_DEFAULT_PROFILE = {
    **DEFAULT_PROFILE,
    "goal": "Просушиться и привести себя в форму",
    "experience": "Раньше занимался армрестлингом, сейчас не занимаюсь.",
    "preferences": "Люблю долгую фитнес-разминку всего тела перед основной тренировкой.",
}
KIND_NAMES = {"workout": "Тренировка", "weight": "Вес тела", "sleep": "Сон", "nutrition": "Питание", "feeling": "Самочувствие", "note": "Заметка", "rest": "Отдых"}


class InvalidData(ValueError):
    pass


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def object_value(value, label="Запрос"):
    if not isinstance(value, dict):
        raise InvalidData(f"{label}: нужен JSON-объект.")
    return value


def text_value(value, label, maximum, minimum=0):
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
        raise InvalidData(f"{label}: от {minimum} до {maximum} символов.")
    return value


def numeric(value, label, minimum, maximum, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or (isinstance(value, float) and not math.isfinite(value)):
        raise InvalidData(f"{label}: укажи число.")
    if not minimum <= value <= maximum or (integer and value != int(value)):
        raise InvalidData(f"{label}: допустимо от {minimum} до {maximum}.")
    return int(value) if integer else value


def boolean(value, label):
    if type(value) is not bool:
        raise InvalidData(f"{label}: нужно true или false.")
    return value


def day_value(value, label="Дата"):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise InvalidData(f"{label}: нужен формат ГГГГ-ММ-ДД.")
    try:
        date.fromisoformat(value)
    except ValueError as error:
        raise InvalidData(f"{label}: такой даты нет.") from error
    return value


def uuid_value(value):
    try:
        parsed = UUID(value) if isinstance(value, str) else None
    except (ValueError, AttributeError) as error:
        raise InvalidData("Неверный идентификатор записи: нужен UUID.") from error
    if parsed is None or str(parsed) != value.lower():
        raise InvalidData("Неверный идентификатор записи: нужен UUID.")
    return value


def timestamp_value(value):
    if not isinstance(value, str):
        raise InvalidData("createdAt: нужна дата со временем и часовым поясом.")
    try:
        stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise InvalidData("createdAt: неверная дата со временем.") from error
    if stamp.tzinfo is None:
        raise InvalidData("createdAt: укажи часовой пояс.")
    return value


def clean_name(value):
    return re.sub(r"\s+", " ", value.strip())


ALIASES = {
    "присед": "приседания", "приседы": "приседания", "приседание": "приседания",
    "становая": "становая тяга", "подтягивание": "подтягивания", "отжимание": "отжимания",
    "жим штанги лежа": "жим лежа", "брусья с весом": "брусья с дополнительным весом",
    "брусья с доп весом": "брусья с дополнительным весом",
    "отжимания на брусьях с дополнительным весом": "брусья с дополнительным весом",
    "отжимания на брусьях с доп весом": "брусья с дополнительным весом",
    "подтягивания с весом": "подтягивания с дополнительным весом",
    "подтягивания с доп весом": "подтягивания с дополнительным весом",
    "предплечье штанга": "предплечья со штангой", "предплечья с штангой": "предплечья со штангой",
    "предплечье гантель": "предплечья с гантелью", "блок верт спина": "тяга верхнего блока",
    "спина вертикальный блок": "тяга верхнего блока", "блок гориз спина": "тяга горизонтального блока",
    "спина горизонтальный блок": "тяга горизонтального блока", "лопатка гантель": "лопатка с гантелью",
    "спина нижний блок": "спина: нижний блок", "блок квадрицепс": "разгибание ног в блоке",
    "ноги блок": "ноги в блоке", "верхний грудь": "верх груди", "ваакуум": "вакуум",
}
CANONICAL = {name.casefold().replace("ё", "е"): name for name in [
    "Становая тяга", "Приседания", "Жим ногами", "Выпады", "Разгибание ног", "Сгибание ног",
    "Подтягивания", "Тяга верхнего блока", "Тяга в наклоне", "Брусья", "Жим лёжа", "Отжимания",
    "Жим гантелей", "Жим над головой", "Махи в стороны", "Предплечья со штангой",
    "Предплечья с гантелью", "Сгибания на бицепс", "Разгибания на трицепс", "Ягодичный мост",
    "Подъём на носки", "Скручивания", "Брусья с дополнительным весом", "Подтягивания с дополнительным весом",
]}


def exercise_key(name):
    key = clean_name(name).casefold().replace("ё", "е")
    return ALIASES.get(key, key)


def canonical_name(name):
    return CANONICAL.get(exercise_key(name), clean_name(name))


def normalize_exercise(raw):
    """Read older diaries without changing their rows in the database."""
    raw = raw if isinstance(raw, dict) else {}
    sets = raw.get("sets")
    if not isinstance(sets, list):
        try:
            count = min(30, max(1, int(sets or 1)))
        except (TypeError, ValueError):
            count = 1
        sets = [{"reps": raw.get("reps", 1), "weight": raw.get("weight", 0), "warmup": raw.get("warmup", False), "effort": None} for _ in range(count)]
    groups = raw.get("groups")
    if not isinstance(groups, list):
        groups = [raw["group"]] if raw.get("group") else []
    result = {
        "name": clean_name(str(raw.get("name", "Упражнение"))),
        "groups": list(dict.fromkeys(g for g in groups if isinstance(g, str) and g in GROUPS)),
        "sets": [{"reps": s.get("reps", 1), "weight": s.get("weight", 0), "warmup": bool(s.get("warmup", False)), "effort": s.get("effort") if s.get("effort") in EFFORTS else None} for s in sets if isinstance(s, dict)],
    }
    if raw.get("tracking") == "activity":
        result["tracking"] = "activity"
    if isinstance(raw.get("notes"), str):
        result["notes"] = raw["notes"]
    if isinstance(raw.get("targetReps"), int) and raw["targetReps"] > 0:
        result["targetReps"] = raw["targetReps"]
    return result


def normalize_entry(raw):
    result = dict(raw)
    result["exercises"] = [normalize_exercise(x) for x in raw.get("exercises", [])]
    return result


def normalize_profile(raw, *, local=False):
    profile = copy.deepcopy(LOCAL_DEFAULT_PROFILE if local else DEFAULT_PROFILE)
    if isinstance(raw, dict):
        profile.update({k: v for k, v in raw.items() if k in profile})
    if profile["cycle"] == LEGACY_CYCLE:
        profile["cycle"] = list(CYCLE)
    return profile


def validate_exercise(value):
    raw = object_value(value, "Упражнение")
    name = clean_name(text_value(raw.get("name"), "Название упражнения", 120, 1))
    groups = raw.get("groups", [raw["group"]] if raw.get("group") else [])
    if not isinstance(groups, list) or len(groups) > len(GROUPS) or any(not isinstance(g, str) or g not in GROUPS for g in groups) or len(set(groups)) != len(groups):
        raise InvalidData("Выбери неповторяющиеся группы мышц из списка.")
    sets = raw.get("sets", [])
    if not isinstance(sets, list):
        count = numeric(sets, "Количество подходов", 1, 30, integer=True)
        sets = [{"reps": raw.get("reps"), "weight": raw.get("weight", 0), "effort": None, "warmup": raw.get("warmup", False)} for _ in range(count)]
    tracking = raw.get("tracking", "sets")
    if not isinstance(tracking, str) or tracking not in {"sets", "activity"} or len(sets) > 30:
        raise InvalidData("Не более 30 подходов; тип учёта sets или activity.")
    if tracking == "activity" and sets:
        raise InvalidData("Для активности без подходов сохрани заметку.")
    if tracking != "activity" and not sets:
        raise InvalidData("Добавь хотя бы один выполненный подход.")
    result = {"name": name, "groups": groups.copy(), "sets": []}
    for item in sets:
        item = object_value(item, "Подход")
        effort = item.get("effort")
        if effort is not None and (not isinstance(effort, str) or effort not in EFFORTS):
            raise InvalidData("Неверная оценка тяжести подхода.")
        result["sets"].append({
            "reps": numeric(item.get("reps"), "Повторения", 1, 200, integer=True),
            "weight": numeric(item.get("weight"), "Вес подхода", 0, 600),
            "effort": effort, "warmup": boolean(item.get("warmup", False), "Разминка"),
        })
    if "tracking" in raw:
        result["tracking"] = tracking
    if "notes" in raw:
        result["notes"] = text_value(raw["notes"], "Заметка упражнения", 2000)
    if "targetReps" in raw:
        result["targetReps"] = numeric(raw["targetReps"], "Цель повторений", 1, 1000, integer=True)
    return result


def validate_entry(value, *, defaults=False):
    raw = object_value(value, "Запись")
    identifier = uuid_value(raw.get("id", str(uuid4()) if defaults else None))
    day = day_value(raw.get("date", date.today().isoformat() if defaults else None))
    if day > (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat():
        raise InvalidData("Тренировку из будущего пока нельзя записать.")
    kind = raw.get("kind", "note" if defaults else None)
    if not isinstance(kind, str) or kind not in KINDS:
        raise InvalidData("Неизвестный тип записи.")
    title = text_value(raw.get("title", KIND_NAMES[kind] if defaults else None), "Название записи", 160, 1).strip()
    text = text_value(raw.get("text", "" if defaults else None), "Текст записи", 12000)
    exercises = raw.get("exercises", [])
    if not isinstance(exercises, list) or len(exercises) > 40:
        raise InvalidData("Укажи не более 40 упражнений.")
    exercises = [validate_exercise(x) for x in exercises]
    cycle_index = raw.get("cycleIndex")
    if cycle_index is not None:
        cycle_index = numeric(cycle_index, "Номер плана", 0, 3, integer=True)
    if kind == "workout" and not exercises:
        raise InvalidData("Добавь хотя бы одно упражнение.")
    if kind != "workout" and (exercises or cycle_index is not None):
        raise InvalidData("Упражнения и план доступны только в тренировке.")
    value = raw.get("value")
    if value is not None:
        value = numeric(value, "Значение", -1_000_000, 1_000_000)
    if kind == "weight":
        value = numeric(value, "Вес тела", 20, 400)
    if kind == "sleep" and value is not None:
        value = numeric(value, "Сон", 0, 24)
    return {"id": identifier, "date": day, "kind": kind, "title": title, "text": text, "exercises": exercises, "value": value, "cycleIndex": cycle_index, "createdAt": timestamp_value(raw.get("createdAt", utc_now() if defaults else None))}


def validate_profile(value, *, local=False):
    raw = object_value(value, "Профиль")
    profile = normalize_profile(raw, local=local)
    for field, maximum, minimum in [("name", 60, 0), ("goal", 500, 1), ("experience", 3000, 0), ("preferences", 3000, 0)]:
        profile[field] = text_value(profile[field], field, maximum, minimum)
    profile["frequency"] = numeric(profile["frequency"], "Тренировок в неделю", 1, 7, integer=True)
    profile["gapDays"] = numeric(profile["gapDays"], "Дней до напоминания", 1, 30, integer=True)
    cycle = profile["cycle"]
    if not isinstance(cycle, list) or len(cycle) != 4:
        raise InvalidData("В цикле должно быть четыре тренировки.")
    profile["cycle"] = [text_value(x, "Название плана", 120, 1) for x in cycle]
    profile["reminders"] = boolean(profile["reminders"], "Напоминания")
    profile["aiConsent"] = boolean(profile["aiConsent"], "Согласие на ИИ")
    if not isinstance(profile["reminderTime"], str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", profile["reminderTime"]):
        raise InvalidData("Время напоминания: формат ЧЧ:ММ.")
    if profile["pausedUntil"] != "":
        day_value(profile["pausedUntil"])
    url = text_value(profile["chatgptUrl"], "Ссылка ChatGPT", 300)
    parsed = urlparse(url)
    if url and (parsed.scheme != "https" or parsed.netloc != "chatgpt.com" or not re.fullmatch(r"/c/[a-zA-Z0-9-]+/?", parsed.path) or parsed.query or parsed.fragment):
        raise InvalidData("Нужна ссылка вида https://chatgpt.com/c/…")
    return profile
