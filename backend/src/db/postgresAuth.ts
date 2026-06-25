/**
 * PostgreSQL 사용자·identity token·복구 코드 인증 쿼리를 담당한다.
 * SQLite 구현과 동일하게 민감한 원본 값 대신 해시를 저장·비교한다.
 */

import type { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { sha256 } from '../utils/security.js';
import type { UserRecord } from './types.js';

export async function createPostgresUser(
  pool: Pool,
  input: { publicId: string; displayName?: string | undefined; recoveryCodeHash: string | null }
): Promise<UserRecord> {
  const id = uuidv4();
  await pool.query('INSERT INTO users (id, public_id, display_name, recovery_code_hash, created_at) VALUES ($1, $2, $3, $4, $5)', [
    id,
    input.publicId,
    input.displayName ?? null,
    input.recoveryCodeHash,
    Date.now()
  ]);
  return { id, publicId: input.publicId, displayName: input.displayName };
}

export async function createPostgresIdentityToken(pool: Pool, userId: string, token: string): Promise<void> {
  await pool.query('INSERT INTO identity_tokens (id, user_id, token_hash, created_at) VALUES ($1, $2, $3, $4)', [
    uuidv4(),
    userId,
    sha256(token),
    Date.now()
  ]);
}

export async function findPostgresUserByToken(pool: Pool, token: string): Promise<UserRecord | null> {
  const result = await pool.query(
    `SELECT u.id, u.public_id as "publicId", u.display_name as "displayName"
     FROM identity_tokens it
     INNER JOIN users u ON u.id = it.user_id
     WHERE it.token_hash = $1 AND it.revoked_at IS NULL
     LIMIT 1`,
    [sha256(token)]
  );
  return (result.rows[0] as UserRecord | undefined) ?? null;
}

export async function findPostgresUserByRecoveryCode(pool: Pool, recoveryCode: string): Promise<UserRecord | null> {
  const result = await pool.query(
    'SELECT id, public_id as "publicId", display_name as "displayName" FROM users WHERE recovery_code_hash = $1 LIMIT 1',
    [sha256(recoveryCode)]
  );
  return (result.rows[0] as UserRecord | undefined) ?? null;
}
