/**
 * PostgreSQL typing presence upsert와 proactive event 조회·기록을 담당한다.
 * 세션별 최신 typing 값은 지연 메시지 전송 여부를 결정한다.
 */

import type { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export async function setPostgresTypingPresence(
  pool: Pool,
  input: { sessionId: string; userId: string; isTyping: boolean }
): Promise<void> {
  const now = Date.now();
  await pool.query(
    `INSERT INTO typing_presence (id, session_id, user_id, is_typing, last_typing_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (session_id)
     DO UPDATE SET is_typing = EXCLUDED.is_typing, last_typing_at = EXCLUDED.last_typing_at, updated_at = EXCLUDED.updated_at`,
    [uuidv4(), input.sessionId, input.userId, input.isTyping ? 1 : 0, now, now]
  );
}

export async function isPostgresUserTyping(pool: Pool, sessionId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT is_typing as "isTyping", last_typing_at as "lastTypingAt" FROM typing_presence WHERE session_id = $1 LIMIT 1',
    [sessionId]
  );
  const row = result.rows[0] as { isTyping: number; lastTypingAt: number } | undefined;
  if (!row || row.isTyping === 0) return false;
  return Date.now() - row.lastTypingAt < 6000;
}

export async function recordPostgresProactiveEvent(
  pool: Pool,
  input: { sessionId: string; decision: string; reason: string; sentMessageId?: string }
): Promise<void> {
  await pool.query(
    'INSERT INTO proactive_events (id, session_id, decision, reason, sent_message_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [uuidv4(), input.sessionId, input.decision, input.reason, input.sentMessageId ?? null, Date.now()]
  );
}

export async function getLastPostgresProactiveEventAt(pool: Pool, sessionId: string): Promise<number | undefined> {
  const result = await pool.query(
    'SELECT created_at as "createdAt" FROM proactive_events WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
    [sessionId]
  );
  return (result.rows[0] as { createdAt: number } | undefined)?.createdAt;
}
