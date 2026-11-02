"""Reset only a local SQLite diary after confirmation and verified backup."""
import argparse
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def reset(file):
    file = Path(file).resolve()
    if not file.is_file():
        raise ValueError('Файл дневника не найден.')
    tables = ('entries', 'messages', 'profiles', 'advice')
    with sqlite3.connect(str(file)) as connection:
        if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Проверка базы не пройдена, сброс отменён.')
        backup_dir = file.parent / 'backups'
        backup_dir.mkdir(exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup = backup_dir / ('diary-before-reset-' + stamp + '.sqlite')
        with sqlite3.connect(str(backup)) as saved:
            connection.backup(saved)
            if saved.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('Резервная копия не прошла проверку, сброс отменён.')
        connection.execute('BEGIN IMMEDIATE')
        try:
            for table in tables:
                connection.execute('DELETE FROM ' + table)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return backup


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--yes', action='store_true')
    args = parser.parse_args()
    if os.environ.get('DATABASE_URL'):
        raise SystemExit('Сброс предназначен только для локальной SQLite; DATABASE_URL задан, действие отменено.')
    root = Path(__file__).resolve().parents[1]
    file = Path(os.environ.get('RITM_DB_FILE', str(root / 'data/diary.sqlite')))
    if not file.is_absolute():
        file = root / file
    if not args.yes and input('Удалить записи из %s? Введи СБРОСИТЬ: ' % file).strip() != 'СБРОСИТЬ':
        raise SystemExit('Сброс отменён.')
    print('Дневник очищен. Резервная копия:', reset(file))
