/**
 * SQLite와 PostgreSQL 구현이 공유하는 사용자·세션·Store 계약을 정의한다.
 * 메서드 변경은 두 DB adapter와 route/runtime 호출부를 함께 수정해야 한다.
 */

import type { ConversationSnapshot, MessageRecord, Role } from '@turinglet/shared';

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
  createUser(input: { publicId: string; displayName?: string | undefined; recoveryCodeHash: string | null }): Promise<UserRecord>;
  createIdentityToken(userId: string, token: string): Promise<void>;
  findUserByToken(token: string): Promise<UserRecord | null>;
  findUserByRecoveryCode(recoveryCode: string): Promise<UserRecord | null>;
  createSession(userId: string): Promise<SessionRecord>;
  getLatestSessionByUserId(userId: string): Promise<SessionRecord | null>;
  getSessionById(sessionId: string): Promise<SessionRecord | null>;
  touchSession(sessionId: string): Promise<void>;
  appendMessage(input: { sessionId: string; role: Role; content: string; metadata?: Record<string, unknown> | undefined }): Promise<MessageRecord>;
  listMessages(sessionId: string, limit: number): Promise<MessageRecord[]>;
  setTypingPresence(input: { sessionId: string; userId: string; isTyping: boolean }): Promise<void>;
  isUserTyping(sessionId: string): Promise<boolean>;
  recordProactiveEvent(input: { sessionId: string; decision: string; reason: string; sentMessageId?: string }): Promise<void>;
  getLastProactiveEventAt(sessionId: string): Promise<number | undefined>;
  upsertEmotionalSnapshot(input: { sessionId: string; intensity: number; summary: string }): Promise<void>;
  getConversationSnapshot(sessionId: string): Promise<ConversationSnapshot>;
  listActiveSessions(): Promise<SessionRecord[]>;
  listUsers(): Promise<Array<{ id: string; publicId: string; displayName?: string | undefined; createdAt: number; sessionCount: number }>>;
  listSessions(): Promise<Array<{ id: string; userId: string; active: boolean; createdAt: number; lastSeenAt: number; messageCount: number; lastMessageAt?: number | undefined; lastUserMessageAt?: number | undefined; lastAssistantMessageAt?: number | undefined }>>;
  listMessagesForSession(sessionId: string): Promise<MessageRecord[]>;
  listProactiveEvents(): Promise<Array<{ id: string; sessionId: string; decision: string; reason: string; createdAt: number }>>;
}
