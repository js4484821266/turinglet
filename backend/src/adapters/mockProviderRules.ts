import type { OutboundMessageInstruction } from '@turinglet/shared';

export type Theme = 'anxiety' | 'fatigue' | 'focus' | 'lonely' | 'self_blame' | 'generic';

const BURST_PRESENCE_SEQUENCE = ['typing', 'thinking', 'organizing'] as const;

export function chooseByText(text: string, options: string[]): string {
  if (options.length === 0) return '';
  const seed = [...text].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return options[seed % options.length] ?? '';
}

function isStandaloneUtterance(text: string): boolean {
  return /^(안녕(하세요)?|안녕하세요|네|응|넵|예|고마워요?|감사(합니다)?|맞아요|맞아|오케이|알겠어요|알겠어)$/.test(
    text
  );
}

export function isGreeting(text: string): boolean {
  return /^(안녕|안녕하세요|반가워요|반갑습니다)/.test(text.trim());
}

export function looksLikeContinuation(text: string): boolean {
  const t = text.trim();
  if (!t || isStandaloneUtterance(t)) return false;
  if (/(여기까지|다 말했|끝|이상이야)$/.test(t)) return false;

  const continuationEnding = /([,~…]|\.\.\.)$|(그리고|근데|근데요|또|그래서|그러다|아니|그러면)$/;
  const unfinishedMarker = /(아니|그리고|근데|잠깐|일단|음|어|뭔가)$/.test(t);
  const openClauseTail = /(하면|해서|인데|지만|거든|같아서|같은데|하려고|보니까)$/.test(t);
  return t.length <= 6 || unfinishedMarker || openClauseTail || continuationEnding.test(t);
}

export function detectTheme(text: string): Theme {
  if (/(불안|초조|걱정|긴장|두려)/.test(text)) return 'anxiety';
  if (/(집중|산만|멍하|흩어|손에 안 잡|집중이 안)/.test(text)) return 'focus';
  if (/(지침|지쳤|피곤|번아웃|기운|무기력)/.test(text)) return 'fatigue';
  if (/(외롭|혼자|고립|아무도)/.test(text)) return 'lonely';
  if (/(내 잘못|망했|부끄|자책|후회)/.test(text)) return 'self_blame';
  return 'generic';
}

export function pickIntensityFromText(text: string): number {
  const hardSignals = ['죽고', '무너', '힘들', '망했', '절망', '무의미', '울'];
  const moderateSignals = ['불안', '걱정', '지침', '외로'];
  if (hardSignals.some((s) => text.includes(s))) return 8;
  if (moderateSignals.some((s) => text.includes(s))) return 6;
  return 3;
}

export function extractFocus(text: string): string {
  const tokens = text
    .replace(/[.,!?~()"'`]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const stop = new Set(['그냥', '진짜', '약간', '조금', '정말', '뭔가', '이거', '저거']);
  return tokens.find((t) => !stop.has(t)) ?? '지금 상황';
}

export function buildBurst(
  lines: string[],
  startDelay = 1200,
  stepDelay = 2200
): OutboundMessageInstruction[] {
  return lines.map((content, index) => ({
    content,
    delayMs: startDelay + index * stepDelay,
    presenceBeforeSend: BURST_PRESENCE_SEQUENCE[index % BURST_PRESENCE_SEQUENCE.length] ?? 'typing'
  }));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
