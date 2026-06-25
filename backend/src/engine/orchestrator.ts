/**
 * ??? ???? ??? MultiMessagePlan?? ??? ?? ?? ????.
 * ???? ? ?? ??? ??? ?? ?? ?? ??? LLM? ????.
 * provider ??? fallback ??? ??? ?? ????? ????.
 */

import type { ConversationSnapshot, LLMProviderAdapter, MultiMessagePlan } from '@turinglet/shared';

function isStandaloneUtterance(text: string): boolean {
  return /^(안녕(하세요)?|안녕하세요|네|응|넵|예|고마워요?|감사(합니다)?|맞아요|맞아|오케이|알겠어요|알겠어)$/.test(
    text
  );
}

function likelyUserWillContinue(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isStandaloneUtterance(t)) return false;
  if (/(여기까지|다 말했|끝|이상이야)$/.test(t)) return false;

  const shortFragment = t.length <= 8;
  const connectiveTail = /(그리고|근데|그래서|잠깐|일단|아니|그러면|또|근데요|그리고요)$/.test(t);
  const openClauseTail = /(하면|해서|인데|지만|거든|같아서|같은데|하려고|보니까|는데|고|죠|네요|더라|니까|길래|니까요|데요|던데|듯)$/.test(t);
  const trailingDots = /(\.\.\.|…)$/.test(t);
  const trailingCommaLike = /[,~]$/.test(t);
  const trailingVerbCue = /(하다|되다|가다|오다|들어가다|나가다|있다|없다|싶다|같다|느끼다|말하다|생각하다)$/.test(t);
  return shortFragment || connectiveTail || openClauseTail || trailingDots || trailingCommaLike || trailingVerbCue;
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
