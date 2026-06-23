# 03 해설: 프로젝트 지도

## 1. 기본

`shared`는 여러 패키지가 같은 타입을 공유하게 한다. 예를 들어 `MultiMessagePlan`을 백엔드와 scheduler가 서로 다르게 이해하면 런타임 계약이 깨진다.

근거 코드: [../../shared/src/index.ts](../../shared/src/index.ts)

## 2. 적용

선제 발화 조건의 핵심은 [../../scheduler/src/index.ts](../../scheduler/src/index.ts)의 `evaluateProactiveDecision`이다. 실행 루프와 DB 조회까지 보려면 [../../backend/src/runtime/proactiveLoop.ts](../../backend/src/runtime/proactiveLoop.ts)를 같이 본다.

## 3. 변형

presence 표시 문구만 바꾸는 경우라면 보통 [../../frontend/src/components/ChatPanel.tsx](../../frontend/src/components/ChatPanel.tsx)의 `threadStatusText`를 수정하면 된다. enum 값 자체를 추가하는 변경이면 shared와 backend도 확인해야 한다.

## 4. 독립 수행

찾는 과정 예시:

1. `rg "delayMs"`로 지연 관련 타입과 사용처를 찾는다.
2. [../../shared/src/index.ts](../../shared/src/index.ts)에서 plan 타입을 확인한다.
3. [../../backend/src/runtime/messageQueue.ts](../../backend/src/runtime/messageQueue.ts)에서 timer 실행을 확인한다.
4. [../../backend/src/runtime/reactivePlanner.ts](../../backend/src/runtime/reactivePlanner.ts)에서 queue 호출 시점을 확인한다.
