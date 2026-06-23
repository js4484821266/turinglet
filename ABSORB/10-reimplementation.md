# 10. 재구현 연습

## 학습 목표

- 원본을 보지 않고 핵심 정책의 작은 버전을 다시 작성한다.
- 읽기, 설명하기, 다시 구현하기의 차이를 경험한다.
- 구현 선택의 장단점을 자기 말로 설명한다.

## 앞 문서와의 연결

[09-guided-modifications.md](09-guided-modifications.md)에서 작은 수정 계획을 세웠습니다. 이번에는 핵심 기능 일부를 빈 파일에서 다시 구현하는 사고 연습을 합니다.

## 먼저 생각해 볼 질문

- 원본 코드를 외우는 것과 같은 정책을 다시 설계하는 것은 어떻게 다를까요?
- 테스트가 먼저 있으면 재구현이 왜 쉬워질까요?
- 실제 repo에 넣지 않을 연습 코드라도 어떤 타입부터 정해야 할까요?

## 연습 1: 선제 발화 판단 함수

원본 위치:

- [../scheduler/src/index.ts](../scheduler/src/index.ts)

목표:

`evaluateProactiveDecision`의 작은 버전을 원본 없이 작성합니다.

요구사항:

- 사용자가 입력 중이면 보내지 않는다.
- 사용자의 마지막 메시지가 없으면 보내지 않는다.
- 침묵 시간이 `minSilenceMs`보다 짧으면 보내지 않는다.
- 마지막 선제 발화가 cooldown 안이면 보내지 않는다.
- 위 조건을 모두 통과하면 보낸다.

빈칸 예시:

```ts
interface Snapshot {
  lastUserMessageAt?: number;
  userTyping: boolean;
  recentEmotionalIntensity: number;
}

function decide(input: {
  snapshot: Snapshot;
  now: number;
  lastOutreachAt?: number;
  minSilenceMs: number;
  cooldownMs: number;
}) {
  // TODO: userTyping 확인
  // TODO: lastUserMessageAt 확인
  // TODO: silenceMs 계산
  // TODO: cooldown 확인
  // TODO: shouldSend true 반환
}
```

확인 기준:

- 각 false 반환에 reason이 있어야 합니다.
- 시간 계산은 `now - timestamp` 형태여야 합니다.
- 감정 강도는 reason 또는 suggested state에 반영할 수 있습니다.

## 연습 2: 메시지 계획 큐

원본 위치:

- [../backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts)

목표:

여러 메시지를 `delayMs`에 따라 보내는 작은 큐를 설계합니다.

요구사항:

- 세션별 timer 목록을 저장한다.
- 새 plan이 오면 기존 timer를 지운다.
- 각 메시지 전송 직전 typing 여부를 확인한다.
- 메시지를 저장한 뒤 화면에 emit한다.

생각할 점:

- "저장"과 "emit" 중 하나만 성공하면 어떻게 할 것인가?
- 타이머가 오래 남아 있으면 어떤 문제가 생길 수 있는가?
- 테스트에서는 실제 timer를 기다릴 것인가, fake timer를 쓸 것인가?

## 연습 3: 사용자 발화 continuation 판단

원본 위치:

- [../backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)

목표:

사용자가 더 말할 것 같은 문장을 감지하는 간단한 함수를 작성합니다.

요구사항:

- 빈 문자열은 false
- "안녕", "고마워" 같은 독립 발화는 false
- "그리고", "근데", "그래서"로 끝나면 true
- "..." 또는 ","로 끝나면 true
- 너무 짧은 조각은 true

변형 과제:

- "끝이야", "다 말했어"는 false로 처리합니다.
- 한국어가 아닌 짧은 입력은 어떻게 처리할지 기준을 정합니다.

## 연습 4: 프론트 메시지 store

원본 위치:

- [../frontend/src/store.ts](../frontend/src/store.ts)

목표:

메시지 배열에 새 메시지를 추가하고, 특정 ID의 메시지를 제거하는 작은 store 함수를 직접 작성합니다.

요구사항:

- 원본 배열을 직접 mutate하지 않는다.
- 같은 ID 중복 처리를 할지 말지 기준을 정한다.
- assistant presence의 기본값을 정한다.

## 종합 재구현 과제

원본을 닫고 다음 흐름을 의사코드로 작성하세요.

```text
사용자가 메시지를 보낸다.
서버는 메시지를 저장하고 202를 반환한다.
서버는 잠깐 기다린다.
사용자가 입력 중이면 다시 기다린다.
아니면 plan을 만든다.
plan의 메시지를 delay에 맞춰 저장하고 emit한다.
```

필수 포함 요소:

- sessionId
- typing check
- plan
- queue
- socket emit
- 실패 처리 위치

## 이해 확인 퀴즈

1. 기본: 원본 없이 다시 구현할 때 타입을 먼저 정하는 이유를 설명하세요.
2. 적용: 선제 발화 판단 함수에서 cooldown 검사가 빠지면 어떤 사용자 경험 문제가 생기나요?
3. 변형: 메시지 큐가 새 plan을 받을 때 기존 timer를 지우지 않으면 어떤 일이 생길 수 있나요?
4. 독립 수행: `sendCount: 0`을 지원하는 작은 reactive planner를 의사코드로 작성하세요.

해설: [solutions/10-reimplementation.md](solutions/10-reimplementation.md)

## 핵심 요약

재구현 연습의 목적은 원본을 외우는 것이 아니라, 입력, 조건, 출력, 부작용을 스스로 다시 구성하는 것입니다. 이 단계가 되어야 작은 수정도 더 안전해집니다.

다음 문서: [11-explain-it-yourself.md](11-explain-it-yourself.md)
