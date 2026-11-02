import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const file = join(process.cwd(), 'data', 'diary.sqlite');
if (!existsSync(file)) {
  console.error('Файл дневника data/diary.sqlite отсутствует. Перенеси папку data целиком вместе с проектом.');
  process.exit(1);
}

const db = new DatabaseSync(file, { readOnly: true });
try {
  const check = db.prepare('PRAGMA integrity_check').get();
  if (check?.integrity_check !== 'ok') throw new Error('Проверка целостности SQLite не пройдена');
  const entries = db.prepare("SELECT COUNT(*) AS count FROM entries WHERE user_id = 'local_seedy' AND deleted_at IS NULL").get();
  const workouts = db.prepare("SELECT COUNT(*) AS count FROM entries WHERE user_id = 'local_seedy' AND deleted_at IS NULL AND json_extract(data, '$.kind') = 'workout'").get();
  console.log(`Дневник готов: ${entries?.count ?? 0} записей, из них тренировок — ${workouts?.count ?? 0}.`);
  console.log(`База: ${file}`);
} finally {
  db.close();
}
