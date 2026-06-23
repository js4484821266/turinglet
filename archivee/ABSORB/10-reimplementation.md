# 10. 재구현 연습

## 이번 문서의 학습 목표

- 핵심 정책을 기존 파일을 보지 않고 다시 구현해 본다.
- 읽을 수 있음, 설명할 수 있음, 다시 구현할 수 있음을 구분한다.
- 구현 선택과 실패 조건을 자기 말로 설명한다.

## 앞 문서와의 연결

[09-guided-modifications.md](09-guided-modifications.md)에서 작은 수정을 연습했다. 이제 핵심 부분을 빈 파일에서 다시 작성해 본다.

## 먼저 생각해 볼 질문

조건문 몇 개로 보이는 proactive 판단을 굳이 별도 함수로 분리하면 무엇이 좋아질까?

## 연습 1. proactive decision 다시 구현

원본 파일: [scheduler/src/index.ts](../scheduler/src/index.ts)

목표: `evaluateProactiveDecision`을 기존 구현을 보지 않고 작성한다.

입력 조건:

- 사용자가 typing 중이면 보내지 않는다.
- 마지막 사용자 발화 시간이 없으면 보내지 않는다.
- 침묵 시간이 `minSilenceMs`보다 짧으면 보내지 않는다.
- 최근 outreach가 있고 cooldown 안이면 보내지 않는다.
- 감정 강도 7 이상이면 `high_emotional_load`, 아니면 `proactive_checkin_candidate`를 제안한다.

빈칸 연습:

```ts
type State = 'idle' | 'user_typing' | 'reflective_pause' | 'cooldown_after_outreach' | 'high_emotional_load' | 'proactive_checkin_candidate';

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

export function evaluate(input: Input): Decision {
  // TODO: 1. typing이면 거절한다.
  // TODO: 2. lastUserMessageAt이 없으면 거절한다.
  // TODO: 3. silenceMs를 계산하고 너무 짧으면 거절한다.
  // TODO: 4. cooldown이면 거절한다.
  // TODO: 5. 조건 통과 시 shouldSend true를 반환한다.
}
```

해설은 [solutions/10-reimplementation-solutions.md](solutions/10-reimplementation-solutions.md)에 따로 둔다. 먼저 직접 작성한 뒤 비교한다.

## 연습 2. message queue의 발송 직전 검사 구현

원본 파일: [backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts)

목표: plan messages를 delay에 맞춰 예약하되, 발송 직전에 typing이면 저장하지 않는 queue를 작성한다.

요구사항:

- 같은 session의 기존 timers를 지운다.
- 각 item은 `delayMs` 뒤 실행한다.
- 실행 직전 `store.isUserTyping(sessionId)`를 확인한다.
- typing이면 아무 것도 저장하지 않는다.
- typing이 아니면 assistant message를 append하고 emit한다.

스스로 작성한 뒤 원본과 비교할 때 볼 점:

- timer를 어디에 저장했는가?
- 새 plan이 들어왔을 때 이전 timer를 취소했는가?
- append와 emit의 순서는 자연스러운가?

## 연습 3. continuation heuristic 설명하기

원본 파일: [backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)

목표: `likelyUserWillContinue`의 정규식을 외우지 않고 원리를 설명한다.

변형 문제:

- 한국어가 아닌 입력에서도 쓸 수 있게 하려면 어떤 cue가 필요할까?
- 너무 짧은 메시지를 무조건 continuation으로 보면 어떤 오판이 생길까?
- `안녕`, `고마워`, `네` 같은 standalone utterance를 먼저 제외하는 이유는 무엇인가?

## 연습 4. 전체 흐름을 미니 버전으로 만들기

새 파일을 실제 repo에 만들 필요는 없다. 종이에 다음 함수만 적어 본다.

```ts
function receiveUserMessage(text: string): void
function scheduleReactivePlan(text: string): void
function planForUserMessage(text: string, userTyping: boolean): MultiMessagePlan
function queuePlanMessages(plan: MultiMessagePlan): void
```

각 함수 옆에 입력, 부작용, 실패 조건을 쓴다. 이 4개를 설명할 수 있으면 현재 backend의 큰 흐름을 이해한 것이다.

## 확인 기준

- 원본을 보지 않고 proactive 판단 순서를 재구성할 수 있다.
- `sendCount: 0`을 실패가 아니라 정책 결정으로 설명할 수 있다.
- 발송 직전 typing 확인이 필요한 이유를 race condition 관점에서 설명할 수 있다.
- timer 기반 구조가 서버 재시작에 약하다는 한계를 말할 수 있다.

## 자주 헷갈리는 부분

재구현은 원본과 완전히 같은 코드 스타일을 만드는 훈련이 아니다. 같은 입력에 대해 같은 정책 결과를 내고, 왜 그렇게 했는지 설명하는 훈련이다.

## 이해 확인 질문

- proactive 판단에서 typing 조건을 가장 먼저 보는 이유는 무엇인가?
- cooldown 확인보다 silence window 확인을 먼저 해도 의미가 유지되는가?
- message queue가 provider를 직접 호출하지 않는 이유는 무엇인가?

## 핵심 요약

핵심 구현은 작다. 하지만 작은 조건의 순서가 대화 경험을 크게 바꾼다. 재구현 연습은 조건의 의미를 몸으로 확인하는 과정이다.

다음 문서: [11-explain-it-yourself.md](11-explain-it-yourself.md)
