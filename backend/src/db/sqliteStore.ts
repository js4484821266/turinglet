/**
 * better-sqlite3 연결과 역할별 helper를 공통 비동기 Store 계약으로 묶는다.
 * 생성 시 DB 부모 경로를 준비하며 SQL 오류는 호출자에게 전달한다.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { resolveSqlitePath } from '@turinglet/database';
import type { ConversationSnapshot, MessageRecord, Role } from '@turinglet/shared';
import { findRepoRoot } from './common.js';
import { listSqliteMessagesForSession, listSqliteProactiveEvents, listSqliteSessions, listSqliteUsers } from './sqliteAdmin.js';
import { createSqliteIdentityToken, createSqliteUser, findSqliteUserByRecoveryCode, findSqliteUserByToken } from './sqliteAuth.js';
import { appendSqliteMessage, getSqliteConversationSnapshot, listSqliteMessages, upsertSqliteEmotionalSnapshot } from './sqliteMessages.js';
import { getLastSqliteProactiveEventAt, isSqliteUserTyping, recordSqliteProactiveEvent, setSqliteTypingPresence } from './sqlitePresenceEvents.js';
import { createSqliteSession, getLatestSqliteSessionByUserId, getSqliteSessionById, listSqliteActiveSessions, touchSqliteSession } from './sqliteSessions.js';
import type { SessionRecord, Store, UserRecord } from './types.js';

/**
 * better-sqlite3 연결을 공통 비동기 `Store` 계약으로 노출한다.
 * 생성 시 경로와 부모 디렉터리를 준비하고 SQL은 역할별 helper에 위임한다.
 */
export class SqliteStore implements Store {
  private readonly db: Database.Database;

  constructor(sqlitePath?: string) {
    const repoRoot = findRepoRoot(process.cwd());
    const resolved = sqlitePath ? (path.isAbsolute(sqlitePath) ? sqlitePath : path.resolve(repoRoot, sqlitePath)) : resolveSqlitePath();
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new Database(resolved);
  }

  createUser(input: { publicId: string; displayName?: string | undefined; recoveryCodeHash: string | null }): Promise<UserRecord> {
    return createSqliteUser(this.db, input);
  }
  createIdentityToken(userId: string, token: string): Promise<void> {
    return createSqliteIdentityToken(this.db, userId, token);
  }
  findUserByToken(token: string): Promise<UserRecord | null> {
    return findSqliteUserByToken(this.db, token);
  }
  findUserByRecoveryCode(recoveryCode: string): Promise<UserRecord | null> {
    return findSqliteUserByRecoveryCode(this.db, recoveryCode);
  }
  createSession(userId: string): Promise<SessionRecord> {
    return createSqliteSession(this.db, userId);
  }
  getLatestSessionByUserId(userId: string): Promise<SessionRecord | null> {
    return getLatestSqliteSessionByUserId(this.db, userId);
  }
  getSessionById(sessionId: string): Promise<SessionRecord | null> {
    return getSqliteSessionById(this.db, sessionId);
  }
  touchSession(sessionId: string): Promise<void> {
    return touchSqliteSession(this.db, sessionId);
  }
  appendMessage(input: { sessionId: string; role: Role; content: string; metadata?: Record<string, unknown> | undefined }): Promise<MessageRecord> {
    return appendSqliteMessage(this.db, input);
  }
  listMessages(sessionId: string, limit: number): Promise<MessageRecord[]> {
    return listSqliteMessages(this.db, sessionId, limit);
  }
  setTypingPresence(input: { sessionId: string; userId: string; isTyping: boolean }): Promise<void> {
    return setSqliteTypingPresence(this.db, input);
  }
  isUserTyping(sessionId: string): Promise<boolean> {
    return isSqliteUserTyping(this.db, sessionId);
  }
  recordProactiveEvent(input: { sessionId: string; decision: string; reason: string; sentMessageId?: string }): Promise<void> {
    return recordSqliteProactiveEvent(this.db, input);
  }
  getLastProactiveEventAt(sessionId: string): Promise<number | undefined> {
    return getLastSqliteProactiveEventAt(this.db, sessionId);
  }
  upsertEmotionalSnapshot(input: { sessionId: string; intensity: number; summary: string }): Promise<void> {
    return upsertSqliteEmotionalSnapshot(this.db, input);
  }
  getConversationSnapshot(sessionId: string): Promise<ConversationSnapshot> {
    return getSqliteConversationSnapshot(this.db, sessionId);
  }
  listActiveSessions(): Promise<SessionRecord[]> {
    return listSqliteActiveSessions(this.db);
  }
  listUsers(): ReturnType<Store['listUsers']> {
    return listSqliteUsers(this.db);
  }
  listSessions(): ReturnType<Store['listSessions']> {
    return listSqliteSessions(this.db);
  }
  listMessagesForSession(sessionId: string): Promise<MessageRecord[]> {
    return listSqliteMessagesForSession(this.db, sessionId);
  }
  listProactiveEvents(): ReturnType<Store['listProactiveEvents']> {
    return listSqliteProactiveEvents(this.db);
  }
}
