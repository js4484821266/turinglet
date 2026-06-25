/**
 * REST와 Socket.IO가 공유할 backend origin 및 화면용 응답 타입을 정의한다.
 * 개발에서는 현재 브라우저 host의 4000 포트를, production에서는 동일 origin을 사용한다.
 */

import axios from 'axios';

const configuredBackendOrigin = import.meta.env.VITE_BACKEND_ORIGIN?.trim();

// Keep the backend origin in one place. Mobile/LAN access works because the
// default mirrors the browser host and only swaps the port to the API server.
export const backendOrigin =
  configuredBackendOrigin ||
  (import.meta.env.PROD ? window.location.origin : `${window.location.protocol}//${window.location.hostname}:4000`);

export const api = axios.create({
  baseURL: `${backendOrigin}/api`
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
