import type { ConversationSnapshot, LLMProviderAdapter, SilenceMeaning } from '@turinglet/shared';

export class MessageGenerator {
  constructor(private readonly provider: LLMProviderAdapter) {}

  async createSingle(input: {
    snapshot: ConversationSnapshot;
    kind: 'empathy' | 'question' | 'reflection' | 'checkin';
    userText?: string;
  }): Promise<string> {
    return this.provider.generateMessage({
      snapshot: input.snapshot,
      intent: input.kind,
      userText: input.userText
    });
  }

  async inferSilence(input: {
    snapshot: ConversationSnapshot;
    recentMessages: Array<{ id: string; sessionId: string; role: 'user' | 'assistant' | 'system'; content: string; eventType: 'append'; createdAt: string; metadata?: Record<string, unknown> }>;
  }): Promise<SilenceMeaning> {
    return this.provider.detectUserSilenceMeaning({
      snapshot: input.snapshot,
      recentMessages: input.recentMessages
    });
  }
}
