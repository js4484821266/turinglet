import type {
  ConversationSnapshot,
  LLMProviderAdapter,
  MessageRecord,
  MultiMessagePlan,
  SilenceMeaning
} from '@turinglet/shared';

function chooseByText(text: string, options: string[]): string {
  const seed = [...text].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return options[seed % options.length] ?? options[0];
}

function looksLikeContinuation(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const continuationEnding = /([,~…]|\.\.\.)$|(그리고|근데|근데요|또|그래서|그러다|아니|그러면)$/;
  const shortFragment = t.length <= 22 && !/[.!?]$/.test(t);
  const unfinishedMarker = /(아니|그리고|근데|잠깐|일단|음|어)/.test(t) && !/[.!?]$/.test(t);
  return shortFragment || unfinishedMarker || continuationEnding.test(t);
}

function detectTheme(text: string): 'anxiety' | 'fatigue' | 'lonely' | 'self_blame' | 'generic' {
  if (/(불안|초조|걱정|긴장|두려)/.test(text)) return 'anxiety';
  if (/(지침|지쳤|피곤|번아웃|기운|무기력)/.test(text)) return 'fatigue';
  if (/(외롭|혼자|고립|아무도)/.test(text)) return 'lonely';
  if (/(내 잘못|망했|부끄|자책|후회)/.test(text)) return 'self_blame';
  return 'generic';
}

function pickIntensityFromText(text: string): number {
  const hardSignals = ['죽고', '무너', '힘들', '망했', '절망', '무의미', '울'];
  const moderateSignals = ['불안', '걱정', '지침', '외로'];
  if (hardSignals.some((s) => text.includes(s))) return 8;
  if (moderateSignals.some((s) => text.includes(s))) return 6;
  return 3;
}

export class MockProvider implements LLMProviderAdapter {
  async generateMessage(input: {
    snapshot: ConversationSnapshot;
    intent: 'empathy' | 'question' | 'reflection' | 'checkin';
    userText?: string;
  }): Promise<string> {
    switch (input.intent) {
      case 'empathy':
        return '지금 답이 길지 않아도 괜찮아요. 감정이 크면 말이 잘 안 나오는 게 자연스러워요.';
      case 'question':
        return '지금 당장 해결보다, 오늘 버티는 데 가장 부담되는 한 가지를 같이 골라볼까요?';
      case 'reflection':
        return '당장 결론을 내리지 않아도 돼요. 지금 느끼는 걸 안전하게 꺼내는 속도로 가볼게요.';
      case 'checkin':
        return '혹시 지금은 울거나 생각을 정리하느라 답이 늦을 수 있다고 느껴져요. 준비되면 한 단어만 남겨도 괜찮아요.';
      default:
        return '천천히 괜찮습니다.';
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

    const empathyByTheme: Record<typeof theme, string[]> = {
      anxiety: [
        '긴장이 계속 올라오는 상태처럼 들려요. 지금 몸이 먼저 놀라고 있는 걸 수도 있어요.',
        '불안이 커지면 생각이 빨라져서 더 벅차지죠. 그 반응 자체는 아주 자연스러워요.'
      ],
      fatigue: [
        '많이 지친 톤이 느껴져요. 지금은 잘하려는 힘보다 버티는 힘이 먼저 필요해 보여요.',
        '에너지가 바닥난 느낌이 전해져요. 여기서는 속도를 천천히 해도 괜찮아요.'
      ],
      lonely: [
        '혼자 버티는 느낌이 큰 것 같아요. 그런 상태에서는 말 한 줄 꺼내는 것도 어렵죠.',
        '고립감이 느껴질 때는 작은 반응조차 큰 힘이 되기도 해요. 여기서는 혼자가 아니에요.'
      ],
      self_blame: [
        '자책이 크게 올라오는 상황처럼 들려요. 스스로를 몰아붙이는 마음이 많이 아팠을 것 같아요.',
        '내 탓으로 묶고 싶은 마음이 보이는데, 지금은 판단보다 숨 돌리는 게 먼저일 수 있어요.'
      ],
      generic: [
        '지금 느끼는 무게를 그대로 말해줘서 고마워요. 여기서는 급하게 결론내리지 않아도 돼요.',
        '말해주는 속도 자체가 이미 중요한 신호예요. 천천히 같이 살펴봐요.'
      ]
    };

    const selectedEmpathy = chooseByText(text, empathyByTheme[theme]);

    if (intensity >= 7) {
      return {
        sendCount: 2,
        reason: 'High emotional load: empathy then reflective hold.',
        nextState: 'waiting_after_empathy',
        messages: [
          {
            content: selectedEmpathy,
            delayMs: 700,
            presenceBeforeSend: 'thinking'
          },
          {
            content: chooseByText(text + 'wait', [
              '지금은 제가 먼저 잠깐 기다릴게요. 이어서 말하고 싶어질 때 그때 이어가요.',
              '지금은 정리보다 버티기가 우선일 수 있어요. 준비되면 짧게 신호만 줘도 괜찮아요.'
            ]),
            delayMs: 2200,
            presenceBeforeSend: 'waiting'
          }
        ]
      };
    }

    if (text.trim().endsWith('?')) {
      return {
        sendCount: 2,
        reason: 'Question asked: empathy + one focused question.',
        nextState: 'reflective_pause',
        messages: [
          {
            content: selectedEmpathy,
            delayMs: 600,
            presenceBeforeSend: 'organizing'
          },
          {
            content: chooseByText(text + 'q', [
              '답을 넓게 하기보다, 지금 제일 무거운 포인트 하나부터 짚어볼까요?',
              '해결책을 많이 찾기보다, 지금 가장 버거운 한 장면부터 같이 보죠.'
            ]),
            delayMs: 1700,
            presenceBeforeSend: 'thinking'
          }
        ]
      };
    }

    return {
      sendCount: 1,
      reason: 'Default gentle reflection.',
      nextState: 'reflective_pause',
      messages: [
        {
          content: selectedEmpathy,
          delayMs: 900,
          presenceBeforeSend: 'thinking'
        }
      ]
    };
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
}
