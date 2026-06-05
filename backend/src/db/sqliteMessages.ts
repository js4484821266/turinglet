import type Database from 'better-sqlite3';
import type { ConversationSnapshot, MessageRecord, Role } from '@turinglet/shared';
import { v4 as uuidv4 } from 'uuid';
import { mapState, toMessageRecord } from './common.js';
import { isSqliteUserTyping } from './sqlitePresenceEvents.js';

export async function appendSqliteMessage(
  db: Database.Database,
  input: { sessionId: string; role: Role; content: string; metadata?: Record<string, unknown> | undefined }
): Promise<MessageRecord> {
  const id = uuidv4();
  const now = Date.now();
  db.prepare(
    'INSERT INTO messages (id, session_id, role, content, event_type, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.sessionId, input.role, input.content, 'append', input.metadata ? JSON.stringify(input.metadata) : null, now);
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

export async function listSqliteMessages(
  db: Database.Database,
  sessionId: string,
  limit: number
): Promise<MessageRecord[]> {
  const rows = db
    .prepare(
      'SELECT id, session_id as sessionId, role, content, event_type as eventType, metadata_json as metadataJson, created_at as createdAtMs FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?'
    )
    .all(sessionId, limit) as Array<{
    id: string;
    sessionId: string;
    role: Role;
    content: string;
    eventType: 'append';
    metadataJson: string | null;
    createdAtMs: number;
  }>;
  return rows.map(toMessageRecord);
}

export async function upsertSqliteEmotionalSnapshot(
  db: Database.Database,
  input: { sessionId: string; intensity: number; summary: string }
): Promise<void> {
  db.prepare('INSERT INTO emotional_state_snapshots (id, session_id, intensity, summary, created_at) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(),
    input.sessionId,
    input.intensity,
    input.summary,
    Date.now()
  );
}

export async function getSqliteConversationSnapshot(
  db: Database.Database,
  sessionId: string
): Promise<ConversationSnapshot> {
  const lastUser = db
    .prepare('SELECT created_at as createdAt FROM messages WHERE session_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1')
    .get(sessionId, 'user') as { createdAt: number } | undefined;
  const lastAssistant = db
    .prepare('SELECT created_at as createdAt FROM messages WHERE session_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1')
    .get(sessionId, 'assistant') as { createdAt: number } | undefined;
  const lastAny = db
    .prepare('SELECT created_at as createdAt FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(sessionId) as { createdAt: number } | undefined;
  const emo = db
    .prepare('SELECT intensity FROM emotional_state_snapshots WHERE session_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(sessionId) as { intensity: number } | undefined;
  const typing = await isSqliteUserTyping(db, sessionId);
  const intensity = emo?.intensity ?? 3;

  return {
    sessionId,
    lastUserMessageAt: lastUser?.createdAt,
    lastAssistantMessageAt: lastAssistant?.createdAt,
    lastMessageAt: lastAny?.createdAt,
    recentEmotionalIntensity: intensity,
    userTyping: typing,
    state: mapState(typing, intensity)
  };
}
