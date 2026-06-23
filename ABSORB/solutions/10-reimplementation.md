# 10 해설: 재구현 연습

## 1. 기본

타입을 먼저 정하면 입력, 출력, 부작용의 경계가 선명해진다. 특히 이 프로젝트는 plan, snapshot, presence처럼 비슷해 보이지만 역할이 다른 값이 많다.

## 2. 적용

cooldown 검사가 빠지면 긴 침묵 중 assistant가 반복적으로 먼저 말할 수 있다. 이는 부담 낮은 말동무라는 목표와 충돌한다.

## 3. 변형

새 plan을 받을 때 기존 timer를 지우지 않으면 이전 계획의 메시지와 새 계획의 메시지가 섞여 나갈 수 있다. 사용자는 맥락에 맞지 않는 중복 답변을 받을 수 있다.

## 4. 독립 수행

의사코드 예시:

```ts
schedule(sessionId, userText) {
  wait(graceMs);
  if (isTyping(sessionId)) return reschedule();
  const snapshot = getSnapshot(sessionId);
  const plan = planForUserMessage(snapshot, userText);
  if (plan.sendCount === 0 && canWaitMore()) return reschedule();
  if (plan.sendCount === 0) return queue(forcePlan(snapshot, userText));
  return queue(plan.messages);
}
```

평가 기준: 대기, typing 확인, `sendCount: 0` 처리, forced plan 또는 재예약, queue 연결이 포함되어야 한다.
