import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:4000/api'
});

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface AdminUserRow {
  id: string;
  publicId: string;
  displayName?: string;
  createdAt: number;
  sessionCount: number;
}

export interface AdminSessionRow {
  id: string;
  userId: string;
  active: boolean;
  createdAt: number;
  lastSeenAt: number;
  messageCount: number;
  lastMessageAt?: number;
  lastUserMessageAt?: number;
  lastAssistantMessageAt?: number;
}

export interface AdminProactiveEventRow {
  id: string;
  sessionId: string;
  decision: string;
  reason: string;
  createdAt: number;
}
