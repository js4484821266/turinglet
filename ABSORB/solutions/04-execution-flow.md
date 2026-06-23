# 04 해설: 실행 흐름

## 1. 기본

`/api/chat/messages`는 사용자 메시지를 저장하고 반응 계획을 예약한 뒤 `202`를 반환한다. assistant 메시지 생성은 시간이 걸릴 수 있고, 사용자가 계속 입력하는지 기다려야 하므로 HTTP 요청 안에서 끝내지 않는다.

근거 코드: [../../backend/src/routes/chatRoutes.ts](../../backend/src/routes/chatRoutes.ts), [../../backend/src/runtime/reactivePlanner.ts](../../backend/src/runtime/reactivePlanner.ts)

## 2. 적용

확인 순서 예시:

1. DB에 assistant 메시지가 저장됐는지 확인
2. [../../backend/src/runtime/realtime.ts](../../backend/src/runtime/realtime.ts)의 `emitMessage` 경로 확인
3. 프론트가 `join_session`을 보냈는지 확인
4. [../../frontend/src/components/ChatPanel.tsx](../../frontend/src/components/ChatPanel.tsx)의 socket `message` handler 확인

## 3. 변형

[../../backend/src/runtime/messageQueue.ts](../../backend/src/runtime/messageQueue.ts)는 메시지 전송 직전 `deps.store.isUserTyping`을 확인한다. 사용자가 다시 입력 중이면 해당 assistant 메시지를 보내지 않는다.

## 4. 독립 수행

좋은 순서도에는 `POST`, `appendMessage`, `scheduleReactivePlan`, `typing check`, `planForUserMessage`, `queuePlanMessages`, `emitMessage`, `frontend append`가 포함되어야 한다.
