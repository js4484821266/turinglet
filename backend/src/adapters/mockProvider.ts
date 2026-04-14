import type {
  ConversationSnapshot,
  LLMProviderAdapter,
  MessageRecord,
  OutboundMessageInstruction,
  MultiMessagePlan,
  SilenceMeaning
} from '@turinglet/shared';

function chooseByText(text: string, options: string[]): string {
  if (options.length === 0) return '';
  const seed = [...text].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return options[seed % options.length] ?? '';
}

function isStandaloneUtterance(text: string): boolean {
  return /^(안녕(하세요)?|안녕하세요|네|응|넵|예|고마워요?|감사(합니다)?|맞아요|맞아|오케이|알겠어요|알겠어)$/.test(
    text
  );
}

function isGreeting(text: string): boolean {
  return /^(안녕|안녕하세요|반가워요|반갑습니다)/.test(text.trim());
}

function looksLikeContinuation(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isStandaloneUtterance(t)) return false;
  if (/(여기까지|다 말했|끝|이상이야)$/.test(t)) return false;
  const continuationEnding = /([,~…]|\.\.\.)$|(그리고|근데|근데요|또|그래서|그러다|아니|그러면)$/;
  const shortFragment = t.length <= 6;
  const unfinishedMarker = /(아니|그리고|근데|잠깐|일단|음|어|뭔가)$/.test(t);
  const openClauseTail = /(하면|해서|인데|지만|거든|같아서|같은데|하려고|보니까)$/.test(t);
  return shortFragment || unfinishedMarker || openClauseTail || continuationEnding.test(t);
}

function detectTheme(text: string): 'anxiety' | 'fatigue' | 'focus' | 'lonely' | 'self_blame' | 'generic' {
  if (/(불안|초조|걱정|긴장|두려)/.test(text)) return 'anxiety';
  if (/(집중|산만|멍하|흩어|손에 안 잡|집중이 안)/.test(text)) return 'focus';
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

function buildBurst(lines: string[], startDelay = 1200, stepDelay = 2200): OutboundMessageInstruction[] {
  const presenceSequence = ['typing', 'thinking', 'organizing'] as const;
  return lines.map((content, index) => ({
    content,
    delayMs: startDelay + index * stepDelay,
    presenceBeforeSend: presenceSequence[index % presenceSequence.length]
  }));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function extractFocus(text: string): string {
  const tokens = text
    .replace(/[.,!?~()"'`]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const stop = new Set(['그냥', '진짜', '약간', '조금', '정말', '뭔가', '이거', '저거']);
  const candidate = tokens.find((t) => !stop.has(t));
  return candidate ?? '지금 상황';
}

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
    if (isGreeting(text)) {
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

    const empathyByTheme: Record<typeof theme, string[]> = {
      anxiety: [
        `긴장이 계속 올라오는 상태처럼 들려요. ${focus} 때문에 몸이 먼저 놀라고 있을 수도 있어요.`,
        `불안이 커지면 생각이 빨라져서 더 벅차지죠. ${focus}에서 그런 반응이 나오는 건 자연스러워요.`,
        `${focus}를 다루는 동안 마음이 급해지는 게 느껴져요. 지금은 속도를 낮춰도 괜찮아요.`
      ],
      fatigue: [
        `많이 지친 톤이 느껴져요. ${focus}를 견디는 데 에너지가 많이 빠진 것 같아요.`,
        '에너지가 바닥난 느낌이 전해져요. 여기서는 속도를 천천히 해도 괜찮아요.',
        `${focus}를 붙잡고 있었던 시간 자체가 길었을 수 있어요. 지금은 버티는 기준으로 볼게요.`
      ],
      focus: [
        `집중이 풀리는 느낌이 계속되면 ${focus} 자체가 더 버겁게 느껴질 수 있어요.`,
        `${focus} 앞에서 머리가 자꾸 흩어지는 상태 같아요. 의지가 약해서라기보다 피로가 쌓였을 때 자주 그래요.`,
        `${focus}에 바로 몰입이 안 되는 게 이상한 건 아니에요. 지금은 진입 장벽을 낮추는 쪽이 더 현실적이에요.`
      ],
      lonely: [
        `혼자 버티는 느낌이 큰 것 같아요. ${focus} 같은 이야기는 더 꺼내기 어렵죠.`,
        '고립감이 느껴질 때는 작은 반응조차 큰 힘이 되기도 해요. 여기서는 혼자가 아니에요.',
        `${focus}를 혼자 감당하고 있었다면 지금 말 꺼낸 것만으로도 큰 변화예요.`
      ],
      self_blame: [
        `자책이 크게 올라오는 상황처럼 들려요. ${focus}를 전부 내 탓으로 묶고 싶어졌을 수 있어요.`,
        '내 탓으로 묶고 싶은 마음이 보이는데, 지금은 판단보다 숨 돌리는 게 먼저일 수 있어요.',
        `${focus}를 떠올릴수록 스스로를 몰아붙이게 되는 패턴이 보이네요. 지금은 강도를 낮춰볼게요.`
      ],
      generic: [
        `지금 느끼는 무게를 이렇게 바로 말해줘서 고마워요. ${focus}부터 차근히 볼게요.`,
        `${focus} 때문에 머리가 복잡해진 상태로 들려요. 지금은 핵심 하나만 붙잡아도 충분해요.`,
        `${focus}를 다루는 방식은 사람마다 달라요. 네 리듬에 맞춰서 이어가보자.`
      ]
    };

    const selectedEmpathy = chooseByText(text, empathyByTheme[theme]);

    if (intensity >= 7) {
      const deepBurstCandidate = clamp(Math.floor(text.length / 28), 4, 12);
      const longNarrative = text.length >= 160;
      const linePool = [
        selectedEmpathy,
        chooseByText(text + 'h1', [
          '지금은 정리보다 버티는 쪽이 더 맞아 보여요.',
          '길게 설명하지 않아도 흐름은 충분히 느껴져요.'
        ]),
        chooseByText(text + 'h2', [
          '내가 너무 앞서가지 않게 속도를 맞출게요.',
          '당장 결론을 붙이지 않아도 돼요. 지금은 맥락을 먼저 볼게요.'
        ]),
        chooseByText(text + 'h3', [
          '지금 가장 걸리는 장면 하나만 집어줘도 충분해요.',
          '제일 먼저 건드려진 부분부터 같이 보죠.'
        ]),
        chooseByText(text + 'h4', [
          '숨을 크게 바꾸기 어렵다면, 그냥 멈춰 있는 상태여도 괜찮아요.',
          '지금은 잘 정리하는 것보다 덜 흔들리는 쪽이 더 중요해 보여요.'
        ]),
        chooseByText(text + 'h5', [
          '내가 먼저 서두르지 않을게요. 이어서 말하고 싶으면 그때 붙이면 돼요.',
          '짧게 이어도 되고, 잠깐 멈춰도 돼요. 흐름만 같이 잡아볼게요.'
        ])
      ];

      const targetCount = longNarrative ? deepBurstCandidate : 3;
      const lines: string[] = [];
      for (let i = 0; i < targetCount; i += 1) {
        lines.push(linePool[i % linePool.length] ?? selectedEmpathy);
      }

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

    if (text.trim().endsWith('?')) {
      const questionLines = [
        selectedEmpathy,
        chooseByText(text + 'q', [
          '답을 넓게 하기보다, 지금 제일 무거운 포인트 하나부터 짚어볼까요?',
          '해결책을 많이 찾기보다, 지금 가장 버거운 한 장면부터 같이 보죠.'
        ])
      ];
      const messages = buildBurst(questionLines, 1400, 2800);
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
        '내가 앞서 해석하지 않도록, 한 번에 하나씩 볼게요.'
      ]),
      chooseByText(text + 'g2', [
        '지금은 해답보다 상황을 정확히 듣는 쪽이 먼저예요.',
        '필요하면 이 대화를 짧은 단위로 나눠서 이어가도 좋아요.'
      ])
    ].slice(0, baseCount);
    const baseMessages = buildBurst(baseLines, 1200, 2200);

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
