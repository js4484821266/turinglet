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
