import { create } from 'zustand';
import type { ChatMessage } from './api';

type PresenceState = 'typing' | 'thinking' | 'organizing' | 'waiting';

interface AppState {
  sessionId?: string;
  userId?: string;
  qrPayload?: string;
  qrDataUrl?: string;
  recoveryCode?: string;
  messages: ChatMessage[];
  assistantPresence: PresenceState;
  userTyping: boolean;
  setAuth: (data: { sessionId: string; userId: string }) => void;
  setRegistration: (data: { qrPayload: string; qrDataUrl: string; recoveryCode?: string }) => void;
  appendMessage: (message: ChatMessage) => void;
  removeMessageById: (messageId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setAssistantPresence: (state: PresenceState) => void;
  setUserTyping: (typing: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  messages: [],
  assistantPresence: 'waiting',
  userTyping: false,
  setAuth: (data) => set(data),
  setRegistration: (data) => set(data),
  appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  removeMessageById: (messageId) => set((s) => ({ messages: s.messages.filter((message) => message.id !== messageId) })),
  setMessages: (messages) => set({ messages }),
  setAssistantPresence: (assistantPresence) => set({ assistantPresence }),
  setUserTyping: (userTyping) => set({ userTyping })
}));
