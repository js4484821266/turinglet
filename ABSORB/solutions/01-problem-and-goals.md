# 01 해설: 문제와 설계 목표

## 1. 기본

예시 답안: 삼마고는 사용자의 입력마다 즉시 답하는 챗봇이 아니라, 사용자가 더 말할 가능성, 입력 중 상태, 긴 침묵의 의미를 함께 고려하는 말동무 프로토타입이다. 그래서 답변 문장 자체뿐 아니라 "지금 보내도 되는가"를 판단한다.

근거 코드: [../../backend/src/engine/orchestrator.ts](../../backend/src/engine/orchestrator.ts), [../../backend/src/runtime/reactivePlanner.ts](../../backend/src/runtime/reactivePlanner.ts)

흔한 오해: "응답이 늦으면 성능 문제"라고 단정하는 것. 이 프로젝트에서는 기다림이 의도된 결과일 수 있다.

채점 기준: 즉시 응답 고정 회피, typing 고려, 침묵 해석 중 2개 이상을 포함하면 충분하다.

## 2. 적용

예시 답안: `sendCount: 0`은 지금 보낼 메시지가 없다는 뜻이며, 실패가 아니다. 예를 들어 사용자가 아직 typing 중이면 [../../backend/src/engine/orchestrator.ts](../../backend/src/engine/orchestrator.ts)의 `planForUserMessage`가 `sendCount: 0`을 반환한다.

## 3. 변형

예시 답안: "그리고..."는 더 말할 가능성이 큰 열린 발화다. [../../backend/src/engine/orchestrator.ts](../../backend/src/engine/orchestrator.ts)의 `likelyUserWillContinue`가 trailing dots와 연결어를 감지할 수 있다.

## 4. 독립 수행

예시 타입:

```ts
interface ResponsePlan {
  shouldSendNow: boolean;
  reason: string;
  messages: Array<{ content: string; delayMs: number }>;
}
```

평가 기준: 내용(`content`)과 시점(`shouldSendNow`, `delayMs`)이 분리되어 있어야 한다.
