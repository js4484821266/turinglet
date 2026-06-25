/**
 * PostgreSQL pool과 역할별 helper를 공통 Store 계약으로 묶는다.
 * pool은 인스턴스 수명 동안 공유하며 연결·SQL 오류를 호출자에게 전달한다.
 */

import type { ConversationSnapshot, MessageRecord, Role } from '@turinglet/shared';
import { Pool } from 'pg';
import { listPostgresMessagesForSession, listPostgresProactiveEvents, listPostgresSessions, listPostgresUsers } from './postgresAdmin.js';
import { createPostgresIdentityToken, createPostgresUser, findPostgresUserByRecoveryCode, findPostgresUserByToken } from './postgresAuth.js';
import { appendPostgresMessage, getPostgresConversationSnapshot, listPostgresMessages, upsertPostgresEmotionalSnapshot } from './postgresMessages.js';
import { getLastPostgresProactiveEventAt, isPostgresUserTyping, recordPostgresProactiveEvent, setPostgresTypingPresence } from './postgresPresenceEvents.js';
import { createPostgresSession, getLatestPostgresSessionByUserId, getPostgresSessionById, listPostgresActiveSessions, touchPostgresSession } from './postgresSessions.js';
import type { SessionRecord, Store, UserRecord } from './types.js';

/**
 * PostgreSQL connection pool을 공통 `Store` 계약으로 감싼 adapter다.
 * pool은 인스턴스 수명 동안 공유하며 연결·SQL 오류를 호출자에게 전달한다.
 */
export class PostgresStore implements Store {
  private readonly pool: Pool;

  constructor(url: string) {
    this.pool = new Pool({ connectionString: url });
  }

  createUser(input: { publicId: string; displayName?: string | undefined; recoveryCodeHash: string | null }): Promise<UserRecord> {
    return createPostgresUser(this.pool, input);
  }
  createIdentityToken(userId: string, token: string): Promise<void> {
    return createPostgresIdentityToken(this.pool, userId, token);
  }
  findUserByToken(token: string): Promise<UserRecord | null> {
    return findPostgresUserByToken(this.pool, token);
  }
  findUserByRecoveryCode(recoveryCode: string): Promise<UserRecord | null> {
    return findPostgresUserByRecoveryCode(this.pool, recoveryCode);
  }
  createSession(userId: string): Promise<SessionRecord> {
    return createPostgresSession(this.pool, userId);
  }
  getLatestSessionByUserId(userId: string): Promise<SessionRecord | null> {
    return getLatestPostgresSessionByUserId(this.pool, userId);
  }
  getSessionById(sessionId: string): Promise<SessionRecord | null> {
    return getPostgresSessionById(this.pool, sessionId);
  }
  touchSession(sessionId: string): Promise<void> {
    return touchPostgresSession(this.pool, sessionId);
  }
  appendMessage(input: { sessionId: string; role: Role; content: string; metadata?: Record<string, unknown> | undefined }): Promise<MessageRecord> {
    return appendPostgresMessage(this.pool, input);
  }
  listMessages(sessionId: string, limit: number): Promise<MessageRecord[]> {
    return listPostgresMessages(this.pool, sessionId, limit);
  }
  setTypingPresence(input: { sessionId: string; userId: string; isTyping: boolean }): Promise<void> {
    return setPostgresTypingPresence(this.pool, input);
  }
  isUserTyping(sessionId: string): Promise<boolean> {
    return isPostgresUserTyping(this.pool, sessionId);
  }
  recordProactiveEvent(input: { sessionId: string; decision: string; reason: string; sentMessageId?: string }): Promise<void> {
    return recordPostgresProactiveEvent(this.pool, input);
  }
  getLastProactiveEventAt(sessionId: string): Promise<number | undefined> {
    return getLastPostgresProactiveEventAt(this.pool, sessionId);
  }
  upsertEmotionalSnapshot(input: { sessionId: string; intensity: number; summary: string }): Promise<void> {
    return upsertPostgresEmotionalSnapshot(this.pool, input);
  }
  getConversationSnapshot(sessionId: string): Promise<ConversationSnapshot> {
    return getPostgresConversationSnapshot(this.pool, sessionId);
  }
  listActiveSessions(): Promise<SessionRecord[]> {
    return listPostgresActiveSessions(this.pool);
  }
  listUsers(): ReturnType<Store['listUsers']> {
    return listPostgresUsers(this.pool);
  }
  listSessions(): ReturnType<Store['listSessions']> {
    return listPostgresSessions(this.pool);
  }
  listMessagesForSession(sessionId: string): Promise<MessageRecord[]> {
    return listPostgresMessagesForSession(this.pool, sessionId);
  }
  listProactiveEvents(): ReturnType<Store['listProactiveEvents']> {
    return listPostgresProactiveEvents(this.pool);
  }
}
