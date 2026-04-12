export type Role = 'user' | 'assistant' | 'system';

export type PresenceState = 'typing' | 'thinking' | 'organizing' | 'waiting';

export type SessionMachineState =
  | 'idle'
  | 'waiting_after_empathy'
  | 'user_typing'
  | 'reflective_pause'
  | 'proactive_checkin_candidate'
  | 'cooldown_after_outreach'
  | 'high_emotional_load';

export type SilenceMeaning =
  | 'crying'
  | 'organizing_thoughts'
  | 'emotionally_overwhelmed'
  | 'away'
  | 'typing';

export interface MessageRecord {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  eventType: 'append';
  createdAt: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface ConversationSnapshot {
  sessionId: string;
  lastUserMessageAt?: number | undefined;
  lastAssistantMessageAt?: number | undefined;
  lastMessageAt?: number | undefined;
  recentEmotionalIntensity: number;
  userTyping: boolean;
  state: SessionMachineState;
}

export interface OutboundMessageInstruction {
  content: string;
  delayMs: number;
  presenceBeforeSend?: PresenceState;
  metadata?: Record<string, unknown>;
}

export interface MultiMessagePlan {
  sendCount: number;
  reason: string;
  nextState: SessionMachineState;
  messages: OutboundMessageInstruction[];
}

export interface LLMProviderAdapter {
  generateMessage(input: {
    snapshot: ConversationSnapshot;
    intent: 'empathy' | 'question' | 'reflection' | 'checkin';
    userText?: string | undefined;
  }): Promise<string>;
  generateMultiMessagePlan(input: {
    snapshot: ConversationSnapshot;
    userText?: string | undefined;
    silenceMeaning?: SilenceMeaning;
  }): Promise<MultiMessagePlan>;
  summarizeConversationState(input: {
    sessionId: string;
    recentMessages: MessageRecord[];
  }): Promise<{ emotionalIntensity: number; summary: string }>;
  detectUserSilenceMeaning(input: {
    snapshot: ConversationSnapshot;
    recentMessages: MessageRecord[];
  }): Promise<SilenceMeaning>;
}

export interface ProactiveDecisionInput {
  snapshot: ConversationSnapshot;
  now: number;
  lastOutreachAt?: number | undefined;
  minSilenceMs: number;
  cooldownMs: number;
}

export interface ProactiveDecision {
  shouldSend: boolean;
  reason: string;
  suggestedState: SessionMachineState;
}
