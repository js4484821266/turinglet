/**
 * SQLite 세션 생성·조회·활성 갱신 쿼리를 담당한다.
 * 세션 ID와 last_seen_at은 인증 및 proactive 대상 조회의 기준이다.
 */

import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { SessionRecord } from './types.js';

export async function createSqliteSession(db: Database.Database, userId: string): Promise<SessionRecord> {
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO sessions (id, user_id, active, created_at, last_seen_at) VALUES (?, ?, 1, ?, ?)').run(
    id,
    userId,
    now,
    now
  );
  return { id, userId };
}

export async function getLatestSqliteSessionByUserId(
  db: Database.Database,
  userId: string
): Promise<SessionRecord | null> {
  const row = db
    .prepare('SELECT id, user_id as userId FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(userId) as SessionRecord | undefined;
  return row ?? null;
}

export async function getSqliteSessionById(db: Database.Database, sessionId: string): Promise<SessionRecord | null> {
  const row = db
    .prepare('SELECT id, user_id as userId FROM sessions WHERE id = ? AND active = 1 LIMIT 1')
    .get(sessionId) as SessionRecord | undefined;
  return row ?? null;
}

export async function touchSqliteSession(db: Database.Database, sessionId: string): Promise<void> {
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(Date.now(), sessionId);
}

export async function listSqliteActiveSessions(db: Database.Database): Promise<SessionRecord[]> {
  return db.prepare('SELECT id, user_id as userId FROM sessions WHERE active = 1').all() as SessionRecord[];
}
