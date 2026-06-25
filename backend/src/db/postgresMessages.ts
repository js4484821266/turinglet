/**
 * PostgreSQL 메시지·감정 snapshot 저장과 대화 snapshot 조립을 담당한다.
 * 쿼리 결과를 공유 MessageRecord와 ConversationSnapshot으로 변환한다.
 */

import type { Pool } from 'pg';
import type { ConversationSnapshot, MessageRecord, Role } from '@turinglet/shared';
import { v4 as uuidv4 } from 'uuid';
import { mapState, parseMetadata } from './common.js';
import { isPostgresUserTyping } from './postgresPresenceEvents.js';

export async function appendPostgresMessage(
  pool: Pool,
  input: { sessionId: string; role: Role; content: string; metadata?: Record<string, unknown> | undefined }
): Promise<MessageRecord> {
  const id = uuidv4();
  const now = Date.now();
  await pool.query(
    'INSERT INTO messages (id, session_id, role, content, event_type, metadata_json, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, input.sessionId, input.role, input.content, 'append', input.metadata ? JSON.stringify(input.metadata) : null, now]
  );
  return {
    id,
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
    eventType: 'append',
    metadata: input.metadata,
    createdAt: new Date(now).toISOString()
  };
}

export async function listPostgresMessages(pool: Pool, sessionId: string, limit: number): Promise<MessageRecord[]> {
  const result = await pool.query(
    'SELECT id, session_id as "sessionId", role, content, event_type as "eventType", metadata_json as "metadataJson", created_at as "createdAtMs" FROM messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2',
    [sessionId, limit]
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    sessionId: row.sessionId as string,
    role: row.role as Role,
    content: row.content as string,
    eventType: 'append',
    metadata: parseMetadata((row.metadataJson as string | null) ?? null),
    createdAt: new Date(row.createdAtMs as number).toISOString()
  }));
}

export async function upsertPostgresEmotionalSnapshot(
  pool: Pool,
  input: { sessionId: string; intensity: number; summary: string }
): Promise<void> {
  await pool.query('INSERT INTO emotional_state_snapshots (id, session_id, intensity, summary, created_at) VALUES ($1, $2, $3, $4, $5)', [
    uuidv4(),
    input.sessionId,
    input.intensity,
    input.summary,
    Date.now()
  ]);
}

export async function getPostgresConversationSnapshot(pool: Pool, sessionId: string): Promise<ConversationSnapshot> {
  const [lastUser, lastAssistant, lastAny, emo, typing] = await Promise.all([
    pool.query('SELECT created_at as "createdAt" FROM messages WHERE session_id = $1 AND role = $2 ORDER BY created_at DESC LIMIT 1', [
      sessionId,
      'user'
    ]),
    pool.query('SELECT created_at as "createdAt" FROM messages WHERE session_id = $1 AND role = $2 ORDER BY created_at DESC LIMIT 1', [
      sessionId,
      'assistant'
    ]),
    pool.query('SELECT created_at as "createdAt" FROM messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1', [sessionId]),
    pool.query('SELECT intensity FROM emotional_state_snapshots WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1', [sessionId]),
    isPostgresUserTyping(pool, sessionId)
  ]);
  const intensity = (emo.rows[0] as { intensity: number } | undefined)?.intensity ?? 3;
  return {
    sessionId,
    lastUserMessageAt: (lastUser.rows[0] as { createdAt: number } | undefined)?.createdAt,
    lastAssistantMessageAt: (lastAssistant.rows[0] as { createdAt: number } | undefined)?.createdAt,
    lastMessageAt: (lastAny.rows[0] as { createdAt: number } | undefined)?.createdAt,
    recentEmotionalIntensity: intensity,
    userTyping: typing,
    state: mapState(typing, intensity)
  };
}
