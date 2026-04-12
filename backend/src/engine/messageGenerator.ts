import type { ConversationSnapshot, LLMProviderAdapter, MessageRecord, SilenceMeaning } from '@turinglet/shared';

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
    recentMessages: MessageRecord[];
  }): Promise<SilenceMeaning> {
    return this.provider.detectUserSilenceMeaning({
      snapshot: input.snapshot,
      recentMessages: input.recentMessages
    });
  }
}
