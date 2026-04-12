import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { resolveSqlitePath } from '@turinglet/database';
import type { ConversationSnapshot, MessageRecord, Role, SessionMachineState } from '@turinglet/shared';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { sha256 } from '../utils/security.js';

export interface UserRecord {
  id: string;
  publicId: string;
  displayName?: string | undefined;
}

export interface SessionRecord {
  id: string;
  userId: string;
}

export interface Store {
  createUser(input: {
    publicId: string;
    displayName?: string | undefined;
    recoveryCodeHash: string | null;
  }): Promise<UserRecord>;
  createIdentityToken(userId: string, token: string): Promise<void>;
  findUserByToken(token: string): Promise<UserRecord | null>;
  findUserByRecoveryCode(recoveryCode: string): Promise<UserRecord | null>;
  createSession(userId: string): Promise<SessionRecord>;
  getLatestSessionByUserId(userId: string): Promise<SessionRecord | null>;
  getSessionById(sessionId: string): Promise<SessionRecord | null>;
  touchSession(sessionId: string): Promise<void>;
  appendMessage(input: {
    sessionId: string;
    role: Role;
    content: string;
    metadata?: Record<string, unknown> | undefined;
  }): Promise<MessageRecord>;
  listMessages(sessionId: string, limit: number): Promise<MessageRecord[]>;
  setTypingPresence(input: { sessionId: string; userId: string; isTyping: boolean }): Promise<void>;
  isUserTyping(sessionId: string): Promise<boolean>;
  recordProactiveEvent(input: {
    sessionId: string;
    decision: string;
    reason: string;
    sentMessageId?: string;
  }): Promise<void>;
  getLastProactiveEventAt(sessionId: string): Promise<number | undefined>;
  upsertEmotionalSnapshot(input: { sessionId: string; intensity: number; summary: string }): Promise<void>;
  getConversationSnapshot(sessionId: string): Promise<ConversationSnapshot>;
  listActiveSessions(): Promise<SessionRecord[]>;
  listUsers(): Promise<Array<{ id: string; publicId: string; displayName?: string | undefined; createdAt: number; sessionCount: number }>>;
  listSessions(): Promise<Array<{ id: string; userId: string; active: boolean; createdAt: number; lastSeenAt: number; messageCount: number; lastMessageAt?: number | undefined; lastUserMessageAt?: number | undefined; lastAssistantMessageAt?: number | undefined }>>;
  listMessagesForSession(sessionId: string): Promise<MessageRecord[]>;
  listProactiveEvents(): Promise<Array<{ id: string; sessionId: string; decision: string; reason: string; createdAt: number }>>;
}

function mapState(userTyping: boolean, intensity: number): SessionMachineState {
  if (userTyping) return 'user_typing';
  if (intensity >= 7) return 'high_emotional_load';
  return 'idle';
}

function parseMetadata(metadataJson: string | null): Record<string, unknown> | undefined {
  if (!metadataJson) return undefined;
  try {
    return JSON.parse(metadataJson) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function findRepoRoot(startDir: string): string {
  let dir = startDir;

  while (true) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const parsed = JSON.parse(raw) as { name?: string };
        if (parsed.name === 'turinglet') {
          return dir;
        }
      } catch {
        // Continue searching parent directories.
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return startDir;
    }
    dir = parent;
  }
}

export class SqliteStore implements Store {
  private readonly db: Database.Database;

  constructor(sqlitePath?: string) {
    const repoRoot = findRepoRoot(process.cwd());
    const resolved = sqlitePath
      ? path.isAbsolute(sqlitePath)
        ? sqlitePath
        : path.resolve(repoRoot, sqlitePath)
      : resolveSqlitePath();
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new Database(resolved);
  }

  async createUser(input: {
    publicId: string;
    displayName?: string;
    recoveryCodeHash: string | null;
  }): Promise<UserRecord> {
    const id = uuidv4();
    this.db
      .prepare(
        'INSERT INTO users (id, public_id, display_name, recovery_code_hash, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, input.publicId, input.displayName ?? null, input.recoveryCodeHash, Date.now());
    return { id, publicId: input.publicId, displayName: input.displayName };
  }

  async createIdentityToken(userId: string, token: string): Promise<void> {
    this.db
      .prepare('INSERT INTO identity_tokens (id, user_id, token_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), userId, sha256(token), Date.now());
  }

  async findUserByToken(token: string): Promise<UserRecord | null> {
    const row = this.db
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

  async findUserByRecoveryCode(recoveryCode: string): Promise<UserRecord | null> {
    const row = this.db
      .prepare(
        'SELECT id, public_id as publicId, display_name as displayName FROM users WHERE recovery_code_hash = ? LIMIT 1'
      )
      .get(sha256(recoveryCode)) as UserRecord | undefined;
    return row ?? null;
  }

  async createSession(userId: string): Promise<SessionRecord> {
    const id = uuidv4();
    const now = Date.now();
    this.db
      .prepare('INSERT INTO sessions (id, user_id, active, created_at, last_seen_at) VALUES (?, ?, 1, ?, ?)')
      .run(id, userId, now, now);
    return { id, userId };
  }

  async getLatestSessionByUserId(userId: string): Promise<SessionRecord | null> {
    const row = this.db
      .prepare('SELECT id, user_id as userId FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(userId) as SessionRecord | undefined;
    return row ?? null;
  }

  async getSessionById(sessionId: string): Promise<SessionRecord | null> {
    const row = this.db
      .prepare('SELECT id, user_id as userId FROM sessions WHERE id = ? AND active = 1 LIMIT 1')
      .get(sessionId) as SessionRecord | undefined;
    return row ?? null;
  }

  async touchSession(sessionId: string): Promise<void> {
    this.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(Date.now(), sessionId);
  }

  async appendMessage(input: {
    sessionId: string;
    role: Role;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<MessageRecord> {
    const id = uuidv4();
    const now = Date.now();
    this.db
      .prepare(
        'INSERT INTO messages (id, session_id, role, content, event_type, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        id,
        input.sessionId,
        input.role,
        input.content,
        'append',
        input.metadata ? JSON.stringify(input.metadata) : null,
        now
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

  async listMessages(sessionId: string, limit: number): Promise<MessageRecord[]> {
    const rows = this.db
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
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      role: row.role,
      content: row.content,
      eventType: row.eventType,
      metadata: parseMetadata(row.metadataJson),
      createdAt: new Date(row.createdAtMs).toISOString()
    }));
  }

  async setTypingPresence(input: { sessionId: string; userId: string; isTyping: boolean }): Promise<void> {
    const existing = this.db
      .prepare('SELECT id FROM typing_presence WHERE session_id = ? LIMIT 1')
      .get(input.sessionId) as { id: string } | undefined;
    const now = Date.now();
    if (existing) {
      this.db
        .prepare('UPDATE typing_presence SET is_typing = ?, last_typing_at = ?, updated_at = ? WHERE id = ?')
        .run(input.isTyping ? 1 : 0, now, now, existing.id);
      return;
    }
    this.db
      .prepare(
        'INSERT INTO typing_presence (id, session_id, user_id, is_typing, last_typing_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(uuidv4(), input.sessionId, input.userId, input.isTyping ? 1 : 0, now, now);
  }

  async isUserTyping(sessionId: string): Promise<boolean> {
    const row = this.db
      .prepare('SELECT is_typing as isTyping, last_typing_at as lastTypingAt FROM typing_presence WHERE session_id = ? LIMIT 1')
      .get(sessionId) as { isTyping: number; lastTypingAt: number } | undefined;
    if (!row) return false;
    if (row.isTyping === 0) return false;
    return Date.now() - row.lastTypingAt < 6000;
  }

  async recordProactiveEvent(input: {
    sessionId: string;
    decision: string;
    reason: string;
    sentMessageId?: string;
  }): Promise<void> {
    this.db
      .prepare(
        'INSERT INTO proactive_events (id, session_id, decision, reason, sent_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(uuidv4(), input.sessionId, input.decision, input.reason, input.sentMessageId ?? null, Date.now());
  }

  async getLastProactiveEventAt(sessionId: string): Promise<number | undefined> {
    const row = this.db
      .prepare('SELECT created_at as createdAt FROM proactive_events WHERE session_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(sessionId) as { createdAt: number } | undefined;
    return row?.createdAt;
  }

  async upsertEmotionalSnapshot(input: { sessionId: string; intensity: number; summary: string }): Promise<void> {
    this.db
      .prepare(
        'INSERT INTO emotional_state_snapshots (id, session_id, intensity, summary, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(uuidv4(), input.sessionId, input.intensity, input.summary, Date.now());
  }

  async getConversationSnapshot(sessionId: string): Promise<ConversationSnapshot> {
    const lastUser = this.db
      .prepare('SELECT created_at as createdAt FROM messages WHERE session_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1')
      .get(sessionId, 'user') as { createdAt: number } | undefined;

    const lastAssistant = this.db
      .prepare('SELECT created_at as createdAt FROM messages WHERE session_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1')
      .get(sessionId, 'assistant') as { createdAt: number } | undefined;

    const lastAny = this.db
      .prepare('SELECT created_at as createdAt FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(sessionId) as { createdAt: number } | undefined;

    const emo = this.db
      .prepare('SELECT intensity FROM emotional_state_snapshots WHERE session_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(sessionId) as { intensity: number } | undefined;

    const typing = await this.isUserTyping(sessionId);
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

  async listActiveSessions(): Promise<SessionRecord[]> {
    return this.db
      .prepare('SELECT id, user_id as userId FROM sessions WHERE active = 1')
      .all() as SessionRecord[];
  }

  async listUsers(): Promise<Array<{ id: string; publicId: string; displayName?: string; createdAt: number; sessionCount: number }>> {
    return this.db
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

  async listSessions(): Promise<
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
    return this.db
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
      .all() as Array<{
      id: string;
      userId: string;
      active: boolean;
      createdAt: number;
      lastSeenAt: number;
      messageCount: number;
      lastMessageAt?: number;
      lastUserMessageAt?: number;
      lastAssistantMessageAt?: number;
    }>;
  }

  async listMessagesForSession(sessionId: string): Promise<MessageRecord[]> {
    return this.listMessages(sessionId, 500);
  }

  async listProactiveEvents(): Promise<Array<{ id: string; sessionId: string; decision: string; reason: string; createdAt: number }>> {
    return this.db
      .prepare(
        'SELECT id, session_id as sessionId, decision, reason, created_at as createdAt FROM proactive_events ORDER BY created_at DESC LIMIT 200'
      )
      .all() as Array<{ id: string; sessionId: string; decision: string; reason: string; createdAt: number }>;
  }
}

export class PostgresStore implements Store {
  private readonly pool: Pool;

  constructor(url: string) {
    this.pool = new Pool({ connectionString: url });
  }

  async createUser(input: {
    publicId: string;
    displayName?: string;
    recoveryCodeHash: string | null;
  }): Promise<UserRecord> {
    const id = uuidv4();
    await this.pool.query(
      'INSERT INTO users (id, public_id, display_name, recovery_code_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, input.publicId, input.displayName ?? null, input.recoveryCodeHash, Date.now()]
    );
    return { id, publicId: input.publicId, displayName: input.displayName };
  }

  async createIdentityToken(userId: string, token: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO identity_tokens (id, user_id, token_hash, created_at) VALUES ($1, $2, $3, $4)',
      [uuidv4(), userId, sha256(token), Date.now()]
    );
  }

  async findUserByToken(token: string): Promise<UserRecord | null> {
    const result = await this.pool.query(
      `SELECT u.id, u.public_id as "publicId", u.display_name as "displayName"
       FROM identity_tokens it
       INNER JOIN users u ON u.id = it.user_id
       WHERE it.token_hash = $1 AND it.revoked_at IS NULL
       LIMIT 1`,
      [sha256(token)]
    );
    return (result.rows[0] as UserRecord | undefined) ?? null;
  }

  async findUserByRecoveryCode(recoveryCode: string): Promise<UserRecord | null> {
    const result = await this.pool.query(
      'SELECT id, public_id as "publicId", display_name as "displayName" FROM users WHERE recovery_code_hash = $1 LIMIT 1',
      [sha256(recoveryCode)]
    );
    return (result.rows[0] as UserRecord | undefined) ?? null;
  }

  async createSession(userId: string): Promise<SessionRecord> {
    const id = uuidv4();
    const now = Date.now();
    await this.pool.query(
      'INSERT INTO sessions (id, user_id, active, created_at, last_seen_at) VALUES ($1, $2, 1, $3, $4)',
      [id, userId, now, now]
    );
    return { id, userId };
  }

  async getLatestSessionByUserId(userId: string): Promise<SessionRecord | null> {
    const result = await this.pool.query(
      'SELECT id, user_id as "userId" FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    return (result.rows[0] as SessionRecord | undefined) ?? null;
  }

  async getSessionById(sessionId: string): Promise<SessionRecord | null> {
    const result = await this.pool.query(
      'SELECT id, user_id as "userId" FROM sessions WHERE id = $1 AND active = 1 LIMIT 1',
      [sessionId]
    );
    return (result.rows[0] as SessionRecord | undefined) ?? null;
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.pool.query('UPDATE sessions SET last_seen_at = $1 WHERE id = $2', [Date.now(), sessionId]);
  }

  async appendMessage(input: {
    sessionId: string;
    role: Role;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<MessageRecord> {
    const id = uuidv4();
    const now = Date.now();
    await this.pool.query(
      'INSERT INTO messages (id, session_id, role, content, event_type, metadata_json, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        id,
        input.sessionId,
        input.role,
        input.content,
        'append',
        input.metadata ? JSON.stringify(input.metadata) : null,
        now
      ]
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

  async listMessages(sessionId: string, limit: number): Promise<MessageRecord[]> {
    const result = await this.pool.query(
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

  async setTypingPresence(input: { sessionId: string; userId: string; isTyping: boolean }): Promise<void> {
    const now = Date.now();
    await this.pool.query(
      `INSERT INTO typing_presence (id, session_id, user_id, is_typing, last_typing_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (session_id)
       DO UPDATE SET is_typing = EXCLUDED.is_typing, last_typing_at = EXCLUDED.last_typing_at, updated_at = EXCLUDED.updated_at`,
      [uuidv4(), input.sessionId, input.userId, input.isTyping ? 1 : 0, now, now]
    );
  }

  async isUserTyping(sessionId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT is_typing as "isTyping", last_typing_at as "lastTypingAt" FROM typing_presence WHERE session_id = $1 LIMIT 1',
      [sessionId]
    );
    const row = result.rows[0] as { isTyping: number; lastTypingAt: number } | undefined;
    if (!row || row.isTyping === 0) return false;
    return Date.now() - row.lastTypingAt < 6000;
  }

  async recordProactiveEvent(input: {
    sessionId: string;
    decision: string;
    reason: string;
    sentMessageId?: string;
  }): Promise<void> {
    await this.pool.query(
      'INSERT INTO proactive_events (id, session_id, decision, reason, sent_message_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), input.sessionId, input.decision, input.reason, input.sentMessageId ?? null, Date.now()]
    );
  }

  async getLastProactiveEventAt(sessionId: string): Promise<number | undefined> {
    const result = await this.pool.query(
      'SELECT created_at as "createdAt" FROM proactive_events WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    );
    return (result.rows[0] as { createdAt: number } | undefined)?.createdAt;
  }

  async upsertEmotionalSnapshot(input: { sessionId: string; intensity: number; summary: string }): Promise<void> {
    await this.pool.query(
      'INSERT INTO emotional_state_snapshots (id, session_id, intensity, summary, created_at) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), input.sessionId, input.intensity, input.summary, Date.now()]
    );
  }

  async getConversationSnapshot(sessionId: string): Promise<ConversationSnapshot> {
    const [lastUser, lastAssistant, lastAny, emo, typing] = await Promise.all([
      this.pool.query(
        'SELECT created_at as "createdAt" FROM messages WHERE session_id = $1 AND role = $2 ORDER BY created_at DESC LIMIT 1',
        [sessionId, 'user']
      ),
      this.pool.query(
        'SELECT created_at as "createdAt" FROM messages WHERE session_id = $1 AND role = $2 ORDER BY created_at DESC LIMIT 1',
        [sessionId, 'assistant']
      ),
      this.pool.query(
        'SELECT created_at as "createdAt" FROM messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
        [sessionId]
      ),
      this.pool.query(
        'SELECT intensity FROM emotional_state_snapshots WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
        [sessionId]
      ),
      this.isUserTyping(sessionId)
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

  async listActiveSessions(): Promise<SessionRecord[]> {
    const result = await this.pool.query(
      'SELECT id, user_id as "userId" FROM sessions WHERE active = 1',
      []
    );
    return result.rows as SessionRecord[];
  }

  async listUsers(): Promise<Array<{ id: string; publicId: string; displayName?: string; createdAt: number; sessionCount: number }>> {
    const result = await this.pool.query(
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

  async listSessions(): Promise<
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
    const result = await this.pool.query(
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
    return result.rows as Array<{
      id: string;
      userId: string;
      active: boolean;
      createdAt: number;
      lastSeenAt: number;
      messageCount: number;
      lastMessageAt?: number;
      lastUserMessageAt?: number;
      lastAssistantMessageAt?: number;
    }>;
  }

  async listMessagesForSession(sessionId: string): Promise<MessageRecord[]> {
    return this.listMessages(sessionId, 500);
  }

  async listProactiveEvents(): Promise<Array<{ id: string; sessionId: string; decision: string; reason: string; createdAt: number }>> {
    const result = await this.pool.query(
      'SELECT id, session_id as "sessionId", decision, reason, created_at as "createdAt" FROM proactive_events ORDER BY created_at DESC LIMIT 200'
    );
    return result.rows as Array<{ id: string; sessionId: string; decision: string; reason: string; createdAt: number }>;
  }
}
