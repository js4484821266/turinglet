import type {
  ConversationSnapshot,
  LLMProviderAdapter,
  MessageRecord,
  MultiMessagePlan,
  SilenceMeaning
} from '@turinglet/shared';
import {
  buildBurst,
  chooseByText,
  clamp,
  detectTheme,
  extractFocus,
  isGreeting,
  looksLikeContinuation,
  pickIntensityFromText
} from './mockProviderRules.js';
import { baseLines, empathyOptions, highLoadLinePool, questionLines } from './mockProviderTemplates.js';

export class MockProvider implements LLMProviderAdapter {
  async generateMessage(input: {
    snapshot: ConversationSnapshot;
    intent: 'empathy' | 'question' | 'reflection' | 'checkin';
    userText?: string;
  }): Promise<string> {
    const text = input.userText?.trim() ?? '';
    const focus = text ? extractFocus(text) : '지금 상황';
    switch (input.intent) {
      case 'empathy':
        return `${focus} 얘기 꺼내는 것만으로도 이미 많이 버틴 거예요. 지금은 길게 설명하지 않아도 돼요.`;
      case 'question':
        return `${focus} 중에서 오늘 제일 마음을 잡아끄는 한 가지만 먼저 짚어볼까요?`;
      case 'reflection':
        return `${focus}를 말하는 동안 속도가 조금 엇갈렸을 수 있어요. 그 페이스 그대로 받아볼게요.`;
      case 'checkin':
        return `지금은 ${focus}를 정리하느라 잠깐 멈춘 걸 수도 있어요. 준비되면 짧게 이어줘도 괜찮아요.`;
      default:
        return `지금은 ${focus}부터 천천히 볼게요.`;
    }
  }

  async generateMultiMessagePlan(input: {
    snapshot: ConversationSnapshot;
    userText?: string;
    silenceMeaning?: SilenceMeaning;
  }): Promise<MultiMessagePlan> {
    if (input.snapshot.userTyping) {
      return { sendCount: 0, reason: 'User typing', nextState: 'user_typing', messages: [] };
    }

    const text = input.userText ?? '';
    if (isGreeting(text)) return this.greetingPlan();
    if (looksLikeContinuation(text)) {
      return {
        sendCount: 0,
        reason: 'User likely to continue speaking; hold response.',
        nextState: 'reflective_pause',
        messages: []
      };
    }

    const intensity = pickIntensityFromText(text);
    const theme = detectTheme(text);
    const focus = extractFocus(text);
    const selectedEmpathy = chooseByText(text, empathyOptions(theme, focus));

    if (intensity >= 7) return this.highIntensityPlan(text, selectedEmpathy);
    if (text.trim().endsWith('?')) return this.questionPlan(text, selectedEmpathy);
    return this.defaultReflectionPlan(text, selectedEmpathy);
  }

  async summarizeConversationState(input: {
    sessionId: string;
    recentMessages: MessageRecord[];
  }): Promise<{ emotionalIntensity: number; summary: string }> {
    const lastUser = [...input.recentMessages].reverse().find((m) => m.role === 'user');
    const base = lastUser ? pickIntensityFromText(lastUser.content) : 3;
    return {
      emotionalIntensity: base,
      summary: lastUser ? `최근 사용자는 "${lastUser.content.slice(0, 40)}" 맥락에서 감정 표현 중.` : '초기 상태'
    };
  }

  async detectUserSilenceMeaning(input: {
    snapshot: ConversationSnapshot;
    recentMessages: MessageRecord[];
  }): Promise<SilenceMeaning> {
    if (input.snapshot.userTyping) return 'typing';
    const lastUser = [...input.recentMessages].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';
    if (text.includes('울')) return 'crying';
    if (text.includes('정리')) return 'organizing_thoughts';
    if (input.snapshot.recentEmotionalIntensity >= 7) return 'emotionally_overwhelmed';
    if (!lastUser) return 'away';
    return 'organizing_thoughts';
  }

  private greetingPlan(): MultiMessagePlan {
    return {
      sendCount: 1,
      reason: 'Greeting detected: natural opening response.',
      nextState: 'reflective_pause',
      messages: [
        {
          content: '안녕하세요. 와줘서 고마워요. 지금 마음에서 제일 먼저 떠오르는 걸 편하게 말해줘도 돼요.',
          delayMs: 450,
          presenceBeforeSend: 'typing'
        }
      ]
    };
  }

  private highIntensityPlan(text: string, selectedEmpathy: string): MultiMessagePlan {
    const longNarrative = text.length >= 160;
    const targetCount = longNarrative ? clamp(Math.floor(text.length / 28), 4, 12) : 3;
    const linePool = highLoadLinePool(text, selectedEmpathy);
    const lines = Array.from({ length: targetCount }, (_, i) => linePool[i % linePool.length] ?? selectedEmpathy);
    const messages = buildBurst(lines, 1200, longNarrative ? 1800 : 2200);
    return {
      sendCount: messages.length,
      reason: longNarrative
        ? 'High emotional load + long narrative: human-like chunked supportive burst.'
        : 'High emotional load: empathy then holding space.',
      nextState: 'waiting_after_empathy',
      messages
    };
  }

  private questionPlan(text: string, selectedEmpathy: string): MultiMessagePlan {
    const messages = buildBurst(questionLines(text, selectedEmpathy), 1400, 2800);
    return {
      sendCount: messages.length,
      reason: 'Question asked: empathy + one focused question.',
      nextState: 'reflective_pause',
      messages
    };
  }

  private defaultReflectionPlan(text: string, selectedEmpathy: string): MultiMessagePlan {
    const baseCount = text.length >= 120 ? 3 : 1;
    const messages = buildBurst(baseLines(text, selectedEmpathy).slice(0, baseCount), 1200, 2200);
    return {
      sendCount: messages.length,
      reason: 'Default gentle reflection.',
      nextState: 'reflective_pause',
      messages
    };
  }
}
