/**
 * SQLite typing presence와 proactive event의 저장·조회 쿼리를 담당한다.
 * typing 값은 메시지 전송 직전 정책 판단에 사용되는 최신 상태다.
 */

import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export async function setSqliteTypingPresence(
  db: Database.Database,
  input: { sessionId: string; userId: string; isTyping: boolean }
): Promise<void> {
  const existing = db.prepare('SELECT id FROM typing_presence WHERE session_id = ? LIMIT 1').get(input.sessionId) as
    | { id: string }
    | undefined;
  const now = Date.now();
  if (existing) {
    db.prepare('UPDATE typing_presence SET is_typing = ?, last_typing_at = ?, updated_at = ? WHERE id = ?').run(
      input.isTyping ? 1 : 0,
      now,
      now,
      existing.id
    );
    return;
  }

  db.prepare(
    'INSERT INTO typing_presence (id, session_id, user_id, is_typing, last_typing_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), input.sessionId, input.userId, input.isTyping ? 1 : 0, now, now);
}

export async function isSqliteUserTyping(db: Database.Database, sessionId: string): Promise<boolean> {
  const row = db
    .prepare('SELECT is_typing as isTyping, last_typing_at as lastTypingAt FROM typing_presence WHERE session_id = ? LIMIT 1')
    .get(sessionId) as { isTyping: number; lastTypingAt: number } | undefined;
  if (!row || row.isTyping === 0) return false;
  return Date.now() - row.lastTypingAt < 6000;
}

export async function recordSqliteProactiveEvent(
  db: Database.Database,
  input: { sessionId: string; decision: string; reason: string; sentMessageId?: string }
): Promise<void> {
  db.prepare(
    'INSERT INTO proactive_events (id, session_id, decision, reason, sent_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), input.sessionId, input.decision, input.reason, input.sentMessageId ?? null, Date.now());
}

export async function getLastSqliteProactiveEventAt(
  db: Database.Database,
  sessionId: string
): Promise<number | undefined> {
  const row = db
    .prepare('SELECT created_at as createdAt FROM proactive_events WHERE session_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(sessionId) as { createdAt: number } | undefined;
  return row?.createdAt;
}
