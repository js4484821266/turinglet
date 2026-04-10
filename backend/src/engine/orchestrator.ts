import type { ConversationSnapshot, LLMProviderAdapter, MultiMessagePlan } from '@turinglet/shared';

function likelyUserWillContinue(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const shortUnfinished = t.length <= 22 && !/[.!?]$/.test(t);
  const connectiveTail = /(그리고|근데|그래서|잠깐|일단|아니|그러면)$/.test(t);
  const trailingDots = /(\.\.\.|…)$/.test(t);
  return shortUnfinished || connectiveTail || trailingDots;
}

export class ConversationOrchestrator {
  constructor(private readonly provider: LLMProviderAdapter) {}

  async planForUserMessage(input: {
    snapshot: ConversationSnapshot;
    userText: string;
  }): Promise<MultiMessagePlan> {
    if (input.snapshot.userTyping) {
      return {
        sendCount: 0,
        reason: 'User still typing. Defer response.',
        nextState: 'user_typing',
        messages: []
      };
    }
    if (likelyUserWillContinue(input.userText)) {
      return {
        sendCount: 0,
        reason: 'Likely continuation; hold response.',
        nextState: 'reflective_pause',
        messages: []
      };
    }
    return this.provider.generateMultiMessagePlan({
      snapshot: input.snapshot,
      userText: input.userText
    });
  }

  async planForSilence(input: { snapshot: ConversationSnapshot }): Promise<MultiMessagePlan> {
    if (input.snapshot.userTyping) {
      return {
        sendCount: 0,
        reason: 'Typing in progress.',
        nextState: 'user_typing',
        messages: []
      };
    }

    if (input.snapshot.recentEmotionalIntensity >= 7) {
      return {
        sendCount: 1,
        reason: 'High emotional load silence: empathy + wait.',
        nextState: 'waiting_after_empathy',
        messages: [
          {
            content:
              '지금은 울거나 마음을 추스르느라 답이 어려울 수 있어요. 괜찮아요, 저는 잠시 기다리고 있을게요.',
            delayMs: 0,
            presenceBeforeSend: 'waiting'
          }
        ]
      };
    }

    return {
      sendCount: 1,
      reason: 'Low-pressure check-in.',
      nextState: 'proactive_checkin_candidate',
      messages: [
        {
          content: '바로 답하지 않아도 괜찮아요. 괜찮아지는 속도로, 준비되면 한 줄만 남겨줘도 돼요.',
          delayMs: 0,
          presenceBeforeSend: 'waiting'
        }
      ]
    };
  }
}
