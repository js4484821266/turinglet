# 10장 재구현 연습 해설

이 문서는 [10-reimplementation.md](../10-reimplementation.md)의 빈칸 연습을 먼저 직접 시도한 뒤 확인하는 해설이다.

## proactive decision 예시 답안

```ts
type State =
  | 'idle'
  | 'user_typing'
  | 'reflective_pause'
  | 'cooldown_after_outreach'
  | 'high_emotional_load'
  | 'proactive_checkin_candidate';

interface Snapshot {
  lastUserMessageAt?: number;
  recentEmotionalIntensity: number;
  userTyping: boolean;
}

interface Input {
  snapshot: Snapshot;
  now: number;
  lastOutreachAt?: number;
  minSilenceMs: number;
  cooldownMs: number;
}

interface Decision {
  shouldSend: boolean;
  reason: string;
  suggestedState: State;
}

function resolveState(snapshot: Snapshot): State {
  if (snapshot.userTyping) return 'user_typing';
  if (snapshot.recentEmotionalIntensity >= 7) return 'high_emotional_load';
  return 'proactive_checkin_candidate';
}

export function evaluate(input: Input): Decision {
  const suggestedState = resolveState(input.snapshot);

  if (input.snapshot.userTyping) {
    return {
      shouldSend: false,
      reason: 'User is typing; avoid interruption.',
      suggestedState
    };
  }

  if (!input.snapshot.lastUserMessageAt) {
    return {
      shouldSend: false,
      reason: 'No user speech yet; no outreach.',
      suggestedState: 'idle'
    };
  }

  const silenceMs = input.now - input.snapshot.lastUserMessageAt;
  if (silenceMs < input.minSilenceMs) {
    return {
      shouldSend: false,
      reason: 'Silence window too short for outreach.',
      suggestedState: 'reflective_pause'
    };
  }

  if (input.lastOutreachAt && input.now - input.lastOutreachAt < input.cooldownMs) {
    return {
      shouldSend: false,
      reason: 'Outreach cooldown active.',
      suggestedState: 'cooldown_after_outreach'
    };
  }

  return {
    shouldSend: true,
    reason:
      input.snapshot.recentEmotionalIntensity >= 7
        ? 'High emotional load + long silence: send gentle empathy then wait.'
        : 'Long silence and no cooldown: eligible for short check-in.',
    suggestedState
  };
}
```

## 비교할 때 볼 기준

- typing 조건이 가장 먼저 거절되는가?
- 사용자 발화가 없는 세션에는 outreach를 보내지 않는가?
- silence window와 cooldown을 서로 다른 reason으로 설명하는가?
- 감정 강도 7 이상일 때 suggested state가 달라지는가?

원본은 [scheduler/src/index.ts](../../scheduler/src/index.ts)에 있다.
