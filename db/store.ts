import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { normalizeProfile, normalizeEntry, type Advice, type Entry, type Profile, type Message } from '@/lib/fitness';

const file = process.env.RITM_DB_FILE ? resolve(process.env.RITM_DB_FILE) : join(process.cwd(), 'data', 'diary.sqlite');
let connection: DatabaseSync | null = null;

function sqlite() {
  if (!connection) {
    if (!existsSync(file)) throw new Error(`Файл дневника не найден: ${file}. Перенеси всю папку data вместе с проектом.`);
    connection = new DatabaseSync(file);
    connection.exec('PRAGMA busy_timeout = 5000');
  }
  return connection;
}

class LocalStatement {
  constructor(private sql: string, private params: SQLInputValue[] = []) {}
  bind(...params: SQLInputValue[]) { return new LocalStatement(this.sql, params); }
  first<T>() { return (sqlite().prepare(this.sql).get(...this.params) as T | undefined) ?? null; }
  all<T = Record<string, unknown>>() { return { results: sqlite().prepare(this.sql).all(...this.params) as T[] }; }
  run() { return sqlite().prepare(this.sql).run(...this.params); }
  execute() { return /^\s*SELECT\b/i.test(this.sql) ? this.all() : (this.run(), { results: [] }); }
}

export function database() {
  return {
    prepare: (sql: string) => new LocalStatement(sql),
    batch: (statements: LocalStatement[]) => {
      const db = sqlite();
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => statement.execute());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

export async function readDiary(userId: string) {
  const db = database();
  const results = db.batch([
    db.prepare('SELECT data FROM profiles WHERE user_id = ?').bind(userId),
    db.prepare('SELECT data FROM entries WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC').bind(userId),
    db.prepare('SELECT id, role, text, created_at as createdAt FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(userId),
    db.prepare('SELECT data FROM advice WHERE user_id = ?').bind(userId),
  ]);
  return {
    profile: normalizeProfile(results[0].results[0] ? JSON.parse((results[0].results[0] as { data: string }).data) : {}),
    entries: (results[1].results as { data: string }[]).map(row => normalizeEntry(JSON.parse(row.data))) as Entry[],
    messages: (results[2].results as Message[]).reverse(),
    advice: results[3].results[0] ? JSON.parse((results[3].results[0] as { data: string }).data) as Advice : null,
  };
}

export function entryStatement(userId: string, entry: Entry) {
  return database().prepare('INSERT INTO entries (id,user_id,date,data,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,data=excluded.data WHERE entries.user_id=excluded.user_id AND entries.deleted_at IS NULL').bind(entry.id, userId, entry.date, JSON.stringify(entry), entry.createdAt);
}

export function profileStatement(userId: string, profile: Profile) {
  return database().prepare('INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(userId, JSON.stringify(profile), new Date().toISOString());
}
