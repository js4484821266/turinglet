import type Database from 'better-sqlite3';
import type { MessageRecord } from '@turinglet/shared';
import { listSqliteMessages } from './sqliteMessages.js';

export async function listSqliteUsers(
  db: Database.Database
): Promise<Array<{ id: string; publicId: string; displayName?: string; createdAt: number; sessionCount: number }>> {
  return db
    .prepare(
      `SELECT u.id,
              u.public_id as publicId,
              u.display_name as displayName,
              u.created_at as createdAt,
              COUNT(s.id) as sessionCount
       FROM users u
       LEFT JOIN sessions s ON s.user_id = u.id
       GROUP BY u.id, u.public_id, u.display_name, u.created_at
       ORDER BY u.created_at DESC`
    )
    .all() as Array<{ id: string; publicId: string; displayName?: string; createdAt: number; sessionCount: number }>;
}

export async function listSqliteSessions(db: Database.Database): Promise<
  Array<{
    id: string;
    userId: string;
    active: boolean;
    createdAt: number;
    lastSeenAt: number;
    messageCount: number;
    lastMessageAt?: number;
    lastUserMessageAt?: number;
    lastAssistantMessageAt?: number;
  }>
> {
  const rows = db
    .prepare(
      `SELECT s.id,
              s.user_id as userId,
              s.active as active,
              s.created_at as createdAt,
              s.last_seen_at as lastSeenAt,
              COUNT(m.id) as messageCount,
              MAX(m.created_at) as lastMessageAt,
              MAX(CASE WHEN m.role = 'user' THEN m.created_at END) as lastUserMessageAt,
              MAX(CASE WHEN m.role = 'assistant' THEN m.created_at END) as lastAssistantMessageAt
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       GROUP BY s.id, s.user_id, s.active, s.created_at, s.last_seen_at
       ORDER BY s.last_seen_at DESC`
    )
    .all() as Array<{ active: number; [key: string]: unknown }>;
  return rows.map((row) => ({ ...row, active: Boolean(row.active) })) as Awaited<ReturnType<typeof listSqliteSessions>>;
}

export async function listSqliteMessagesForSession(
  db: Database.Database,
  sessionId: string
): Promise<MessageRecord[]> {
  return listSqliteMessages(db, sessionId, 500);
}

export async function listSqliteProactiveEvents(
  db: Database.Database
): Promise<Array<{ id: string; sessionId: string; decision: string; reason: string; createdAt: number }>> {
  return db
    .prepare(
      'SELECT id, session_id as sessionId, decision, reason, created_at as createdAt FROM proactive_events ORDER BY created_at DESC LIMIT 200'
    )
    .all() as Array<{ id: string; sessionId: string; decision: string; reason: string; createdAt: number }>;
}
