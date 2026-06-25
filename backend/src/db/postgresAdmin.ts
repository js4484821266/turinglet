/**
 * 관리자 화면용 PostgreSQL 사용자·세션·메시지·선제 이벤트 조회를 제공한다.
 * 페이지 표시용 별칭과 숫자 변환을 SQL 결과에 명시한다.
 */

import type { Pool } from 'pg';
import type { MessageRecord } from '@turinglet/shared';
import { listPostgresMessages } from './postgresMessages.js';

export async function listPostgresUsers(
  pool: Pool
): Promise<Array<{ id: string; publicId: string; displayName?: string; createdAt: number; sessionCount: number }>> {
  const result = await pool.query(
    `SELECT u.id,
            u.public_id as "publicId",
            u.display_name as "displayName",
            u.created_at as "createdAt",
            COUNT(s.id)::int as "sessionCount"
     FROM users u
     LEFT JOIN sessions s ON s.user_id = u.id
     GROUP BY u.id, u.public_id, u.display_name, u.created_at
     ORDER BY u.created_at DESC`
  );
  return result.rows as Array<{ id: string; publicId: string; displayName?: string; createdAt: number; sessionCount: number }>;
}

export async function listPostgresSessions(pool: Pool): Promise<
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
  const result = await pool.query(
    `SELECT s.id,
            s.user_id as "userId",
            s.active = 1 as "active",
            s.created_at as "createdAt",
            s.last_seen_at as "lastSeenAt",
            COUNT(m.id)::int as "messageCount",
            MAX(m.created_at) as "lastMessageAt",
            MAX(CASE WHEN m.role = 'user' THEN m.created_at END) as "lastUserMessageAt",
            MAX(CASE WHEN m.role = 'assistant' THEN m.created_at END) as "lastAssistantMessageAt"
     FROM sessions s
     LEFT JOIN messages m ON m.session_id = s.id
     GROUP BY s.id, s.user_id, s.active, s.created_at, s.last_seen_at
     ORDER BY s.last_seen_at DESC`
  );
  return result.rows as Awaited<ReturnType<typeof listPostgresSessions>>;
}

export async function listPostgresMessagesForSession(pool: Pool, sessionId: string): Promise<MessageRecord[]> {
  return listPostgresMessages(pool, sessionId, 500);
}

export async function listPostgresProactiveEvents(
  pool: Pool
): Promise<Array<{ id: string; sessionId: string; decision: string; reason: string; createdAt: number }>> {
  const result = await pool.query(
    'SELECT id, session_id as "sessionId", decision, reason, created_at as "createdAt" FROM proactive_events ORDER BY created_at DESC LIMIT 200'
  );
  return result.rows as Array<{ id: string; sessionId: string; decision: string; reason: string; createdAt: number }>;
}
