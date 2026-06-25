/**
 * 단일 메시지 생성과 침묵 의미 해석을 LLM provider 계약으로 감싼다.
 * 상태를 보관하지 않으며 provider 실패를 대체 문구로 숨기지 않는다.
 */

import type { ConversationSnapshot, LLMProviderAdapter, MessageRecord, SilenceMeaning } from '@turinglet/shared';

/**
 * 단일 메시지 생성과 침묵 해석을 provider에 위임한다.
 * provider 외의 상태는 유지하지 않으며 provider 예외를 호출자에게 그대로 전달한다.
 */
export class MessageGenerator {
  constructor(private readonly provider: LLMProviderAdapter) {}

  /** snapshot과 발화 의도를 provider 형식으로 변환해 한 메시지를 생성한다. */
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

  /** 최근 메시지와 snapshot으로 사용자 침묵의 의미를 분류한다. */
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
