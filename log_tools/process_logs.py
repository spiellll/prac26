"""Разбор Common Log Format и сравнение двух способов подсчёта статусов.

Запуск из корня проекта: python3 -m log_tools.process_logs log_tools/sample.log
Файл с примерами синтетический и не содержит журнал реального пользователя.
"""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path
import re
from typing import Iterable


LOG_PATTERN = re.compile(
    r'^(?P<address>\S+) \S+ \S+ \[(?P<timestamp>[^\]]+)\] '
    r'"(?P<method>[A-Z]+) (?P<target>\S+) (?P<protocol>HTTP/\d(?:\.\d)?)" '
    r'(?P<status>[1-5]\d{2}) (?P<size>\d+|-)'
    r'(?: "[^"\r\n]*" "[^"\r\n]*")?$'
)


@dataclass(frozen=True)
class LogEntry:
    address: str
    timestamp: datetime
    method: str
    target: str
    protocol: str
    status: int
    bytes_sent: int

    @property
    def path(self) -> str:
        """Группируем запросы по пути, без вариаций параметров поиска."""
        return self.target.split("?", 1)[0]


def parse_line(line: str) -> LogEntry:
    """Разобрать строку Common или Combined Log Format; ошибку не скрываем."""
    match = LOG_PATTERN.fullmatch(line.strip())
    if match is None:
        raise ValueError("Строка не соответствует Common/Combined Log Format")
    fields = match.groupdict()
    try:
        timestamp = datetime.strptime(fields["timestamp"], "%d/%b/%Y:%H:%M:%S %z")
    except ValueError as exc:
        raise ValueError("Некорректная дата в журнале") from exc
    return LogEntry(
        address=fields["address"],
        timestamp=timestamp,
        method=fields["method"],
        target=fields["target"],
        protocol=fields["protocol"],
        status=int(fields["status"]),
        bytes_sent=0 if fields["size"] == "-" else int(fields["size"]),
    )


def read_logs(lines: Iterable[str]) -> tuple[list[LogEntry], list[int]]:
    """Вернуть записи и номера нераспознанных строк, начиная с 1."""
    entries: list[LogEntry] = []
    invalid_lines: list[int] = []
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            entries.append(parse_line(line))
        except ValueError:
            invalid_lines.append(line_number)
    return entries, invalid_lines


def count_statuses_naive(entries: list[LogEntry]) -> dict[int, int]:
    """Вложенные циклы: n записей просматриваем для каждого из m статусов.

    Сложность фазы подсчёта O(n*m), дополнительная память O(m).
    Для HTTP число возможных статусов ограничено; это учебное сравнение
    алгоритмов группировки, а не обещание квадратичной сложности любого лога.
    """
    statuses = {entry.status for entry in entries}
    result: dict[int, int] = {}
    for status in statuses:
        count = 0
        for entry in entries:
            if entry.status == status:
                count += 1
        result[status] = count
    return result


def count_statuses_optimized(entries: list[LogEntry]) -> dict[int, int]:
    """Counter обновляет счётчик за один проход: O(n), память O(m)."""
    return dict(Counter(entry.status for entry in entries))


def summarize(entries: list[LogEntry], invalid_lines: list[int]) -> dict:
    naive = count_statuses_naive(entries)
    optimized = count_statuses_optimized(entries)
    if naive != optimized:
        raise RuntimeError("Результаты двух алгоритмов не совпали")
    return {
        "requests": len(entries),
        "bytes_sent": sum(entry.bytes_sent for entry in entries),
        "server_errors": sum(entry.status >= 500 for entry in entries),
        "by_status": {str(code): optimized[code] for code in sorted(optimized)},
        "by_method": dict(sorted(Counter(entry.method for entry in entries).items())),
        "by_path": dict(sorted(Counter(entry.path for entry in entries).items())),
        "invalid_line_numbers": invalid_lines,
        "algorithms_agree": naive == optimized,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path, help="Файл Common/Combined Log Format")
    parser.add_argument("--strict", action="store_true", help="Код выхода 2 при ошибочных строках")
    args = parser.parse_args(argv)
    try:
        with args.file.open(encoding="utf-8") as source:
            entries, invalid_lines = read_logs(source)
    except (OSError, UnicodeError) as exc:
        parser.error(f"Не удалось прочитать файл: {exc}")
    print(json.dumps(summarize(entries, invalid_lines), ensure_ascii=False, indent=2))
    return 2 if args.strict and invalid_lines else 0


if __name__ == "__main__":
    raise SystemExit(main())
