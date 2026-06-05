import type { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { SessionRecord } from './types.js';

export async function createPostgresSession(pool: Pool, userId: string): Promise<SessionRecord> {
  const id = uuidv4();
  const now = Date.now();
  await pool.query('INSERT INTO sessions (id, user_id, active, created_at, last_seen_at) VALUES ($1, $2, 1, $3, $4)', [
    id,
    userId,
    now,
    now
  ]);
  return { id, userId };
}

export async function getLatestPostgresSessionByUserId(pool: Pool, userId: string): Promise<SessionRecord | null> {
  const result = await pool.query(
    'SELECT id, user_id as "userId" FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return (result.rows[0] as SessionRecord | undefined) ?? null;
}

export async function getPostgresSessionById(pool: Pool, sessionId: string): Promise<SessionRecord | null> {
  const result = await pool.query('SELECT id, user_id as "userId" FROM sessions WHERE id = $1 AND active = 1 LIMIT 1', [
    sessionId
  ]);
  return (result.rows[0] as SessionRecord | undefined) ?? null;
}

export async function touchPostgresSession(pool: Pool, sessionId: string): Promise<void> {
  await pool.query('UPDATE sessions SET last_seen_at = $1 WHERE id = $2', [Date.now(), sessionId]);
}

export async function listPostgresActiveSessions(pool: Pool): Promise<SessionRecord[]> {
  const result = await pool.query('SELECT id, user_id as "userId" FROM sessions WHERE active = 1', []);
  return result.rows as SessionRecord[];
}
