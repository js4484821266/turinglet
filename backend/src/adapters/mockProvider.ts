import type {
  ConversationSnapshot,
  LLMProviderAdapter,
  MessageRecord,
  OutboundMessageInstruction,
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

function buildBurst(lines: string[], startDelay = 500, stepDelay = 650): OutboundMessageInstruction[] {
  return lines.map((content, index) => ({
    content,
    delayMs: startDelay + index * stepDelay,
    presenceBeforeSend: index === lines.length - 1 ? 'waiting' : index % 2 === 0 ? 'organizing' : 'thinking'
  }));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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
      const deepBurstCandidate = clamp(Math.floor(text.length / 28), 4, 12);
      const longNarrative = text.length >= 160;
      const linePool = [
        selectedEmpathy,
        chooseByText(text + 'h1', [
          '지금은 해결보다, 무너지지 않게 붙잡는 게 우선일 수 있어요.',
          '마음이 버겁다면 지금은 길게 설명하지 않아도 충분해요.'
        ]),
        chooseByText(text + 'h2', [
          '내가 여기서 속도를 맞출게요. 급히 정리하려고 하지 않아도 됩니다.',
          '당장 결론을 내지 않아도 괜찮아요. 천천히 안전한 순서로 가요.'
        ]),
        chooseByText(text + 'h3', [
          '지금 제일 거슬리는 감각이 있으면 한 단어만 말해줘도 좋아요.',
          '지금 가장 큰 부담 하나만 골라서 같이 들여다볼까요.'
        ]),
        chooseByText(text + 'h4', [
          '숨을 크게 바꾸기 어렵다면, 어깨 힘만 아주 조금 내려도 충분해요.',
          '지금 할 일은 잘하기가 아니라 버티기예요. 그걸로 충분해요.'
        ]),
        chooseByText(text + 'h5', [
          '여기서는 내가 먼저 기다릴게요. 이어서 말하고 싶어질 때 알려줘요.',
          '지금은 짧은 신호만 보내도 괜찮아요. 예: "여기" 또는 "잠깐".'
        ])
      ];

      const targetCount = longNarrative ? deepBurstCandidate : 3;
      const lines: string[] = [];
      for (let i = 0; i < targetCount; i += 1) {
        lines.push(linePool[i % linePool.length] ?? selectedEmpathy);
      }

      const messages = buildBurst(lines, 550, longNarrative ? 520 : 850);
      return {
        sendCount: messages.length,
        reason: longNarrative
          ? 'High emotional load + long narrative: human-like chunked supportive burst.'
          : 'High emotional load: empathy then holding space.',
        nextState: 'waiting_after_empathy',
        messages
      };
    }

    if (text.trim().endsWith('?')) {
      const questionLines = [
        selectedEmpathy,
        chooseByText(text + 'q', [
          '답을 넓게 하기보다, 지금 제일 무거운 포인트 하나부터 짚어볼까요?',
          '해결책을 많이 찾기보다, 지금 가장 버거운 한 장면부터 같이 보죠.'
        ])
      ];
      const messages = buildBurst(questionLines, 600, 1100);
      return {
        sendCount: messages.length,
        reason: 'Question asked: empathy + one focused question.',
        nextState: 'reflective_pause',
        messages
      };
    }

    const baseCount = text.length >= 120 ? 3 : 1;
    const baseLines = [
      selectedEmpathy,
      chooseByText(text + 'g1', [
        '말을 이어가고 싶으면 계속 적어도 되고, 잠깐 멈춰도 괜찮아요.',
        '내가 너무 빨리 결론 내리지 않도록, 한 단계씩 천천히 볼게요.'
      ]),
      chooseByText(text + 'g2', [
        '지금은 큰 해답보다 작은 안정이 먼저일 수 있어요.',
        '필요하면 이 대화를 아주 짧게 끊어서 이어가도 좋아요.'
      ])
    ].slice(0, baseCount);
    const baseMessages = buildBurst(baseLines, 700, 900);

    return {
      sendCount: baseMessages.length,
      reason: 'Default gentle reflection.',
      nextState: 'reflective_pause',
      messages: baseMessages
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
