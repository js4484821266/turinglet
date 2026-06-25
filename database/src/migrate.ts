/**
 * SQL migration 파일을 순서대로 SQLite에 적용하는 CLI 진입점이다.
 * 적용 이력은 schema_migrations에 기록하며 SQL 또는 파일 오류는 호출자에게 드러낸다.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { resolveSqlitePath } from './env.js';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const dbPath = resolveSqlitePath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  executed_at INTEGER NOT NULL
);
`);

const migrationsDir = path.resolve(process.cwd(), 'migrations');
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const hasMigration = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?');
const insertMigration = db.prepare('INSERT INTO schema_migrations (id, executed_at) VALUES (?, ?)');

for (const file of migrationFiles) {
  const row = hasMigration.get(file);
  if (row) continue;

  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  db.exec('BEGIN');
  try {
    db.exec(sql);
    insertMigration.run(file, Date.now());
    db.exec('COMMIT');
    console.log(`Applied migration ${file}`);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

console.log(`Migrations complete. DB: ${dbPath}`);
