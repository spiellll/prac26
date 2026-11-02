import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { DatabaseSync, backup } from 'node:sqlite';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = process.env.RITM_DB_FILE ? resolve(process.env.RITM_DB_FILE) : join(root, 'data', 'diary.sqlite');
const tables = ['entries', 'messages', 'profiles', 'advice'];

if (!existsSync(file)) {
  console.error(`Дневник не найден: ${file}. Сброс отменён.`);
  process.exit(1);
}

const db = new DatabaseSync(file);
try {
  const integrity = db.prepare('PRAGMA integrity_check').get();
  if (integrity?.integrity_check !== 'ok') throw new Error('База повреждена. Сброс отменён.');
  const counts = Object.fromEntries(tables.map(table => [table, Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count ?? 0)]));
  console.log(`Сейчас в дневнике: ${counts.entries} записей, ${counts.messages} сообщений, ${counts.profiles} профилей.`);

  if (!process.argv.includes('--yes')) {
    if (!process.stdin.isTTY) throw new Error('Для сброса без интерактивного ввода добавь --yes.');
    const input = createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try { answer = await input.question('Для очистки введи СБРОСИТЬ: '); }
    finally { input.close(); }
    if (answer.trim() !== 'СБРОСИТЬ') {
      console.log('Сброс отменён. Записи не изменены.');
      process.exit(0);
    }
  }

  const backupDir = join(dirname(file), 'backups');
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = join(backupDir, `diary-before-reset-${stamp}-${process.pid}.sqlite`);
  await backup(db, backupFile);
  const saved = new DatabaseSync(backupFile, { readOnly: true });
  try {
    if (saved.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new Error('Не удалось проверить резервную копию. Сброс отменён.');
    for (const table of tables) {
      const count = Number(saved.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count ?? 0);
      if (count !== counts[table]) throw new Error('Резервная копия отличается от дневника. Сброс отменён.');
    }
  } finally { saved.close(); }

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const table of tables) db.exec(`DELETE FROM ${table}`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  console.log(`Дневник очищен. Резервная копия: ${backupFile}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
