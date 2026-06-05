import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { sha256 } from '../utils/security.js';
import type { UserRecord } from './types.js';

export async function createSqliteUser(
  db: Database.Database,
  input: { publicId: string; displayName?: string | undefined; recoveryCodeHash: string | null }
): Promise<UserRecord> {
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, public_id, display_name, recovery_code_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    input.publicId,
    input.displayName ?? null,
    input.recoveryCodeHash,
    Date.now()
  );
  return { id, publicId: input.publicId, displayName: input.displayName };
}

export async function createSqliteIdentityToken(db: Database.Database, userId: string, token: string): Promise<void> {
  db.prepare('INSERT INTO identity_tokens (id, user_id, token_hash, created_at) VALUES (?, ?, ?, ?)').run(
    uuidv4(),
    userId,
    sha256(token),
    Date.now()
  );
}

export async function findSqliteUserByToken(db: Database.Database, token: string): Promise<UserRecord | null> {
  const row = db
    .prepare(
      `SELECT u.id as id, u.public_id as publicId, u.display_name as displayName
       FROM identity_tokens it
       INNER JOIN users u ON u.id = it.user_id
       WHERE it.token_hash = ? AND it.revoked_at IS NULL
       LIMIT 1`
    )
    .get(sha256(token)) as UserRecord | undefined;
  return row ?? null;
}

export async function findSqliteUserByRecoveryCode(
  db: Database.Database,
  recoveryCode: string
): Promise<UserRecord | null> {
  const row = db
    .prepare('SELECT id, public_id as publicId, display_name as displayName FROM users WHERE recovery_code_hash = ? LIMIT 1')
    .get(sha256(recoveryCode)) as UserRecord | undefined;
  return row ?? null;
}
