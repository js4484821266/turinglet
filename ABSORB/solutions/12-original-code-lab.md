# 12장 해설과 채점 기준

## 1. 202 응답

사용자 메시지가 검증되어 DB에 저장되고 reactive 계획이 예약되었다는 것만 보장합니다. assistant 계획 생성, LLM 성공, queue 저장과 Socket.IO 도착은 보장하지 않습니다. 관련 코드는 [../../backend/src/routes/chatRoutes.ts](../../backend/src/routes/chatRoutes.ts)입니다.

## 2. sequence 없는 경우

첫 메시지 A의 timer가 대기하는 동안 B가 들어오고, B 계획이 먼저 처리된 뒤 A callback이 실행될 수 있습니다. 그러면 최신 맥락과 맞지 않는 A 답변이 B 뒤에 도착합니다. timer 취소만으로 이미 실행 대기열에 들어간 callback을 항상 막는다고 가정하면 안 됩니다.

## 3. DB 성공, Socket.IO 실패

DB에는 assistant 메시지가 남지만 현재 연결된 화면에는 즉시 보이지 않을 수 있습니다. 새로고침 또는 `GET /api/chat/messages`로 다시 읽으면 나타납니다. 반대로 emit을 먼저 했다면 화면에는 보였지만 DB에는 없는 더 위험한 상태가 생길 수 있습니다.

## 4. 첫 생성 timeout 확인 순서

1. Python LLM 서버의 `/health`와 모델 경로를 확인합니다.
2. Python 로그에서 lock 대기, 생성 시간, native 오류를 확인합니다.
3. backend의 `HF_LOCAL_TIMEOUT_MS`와 provider abort 오류를 확인합니다.
4. `HF_CONTEXT_SIZE`, prompt 크기, 모델 속도를 확인합니다.

health 성공은 모델 파일을 로드했다는 뜻이지 모든 생성이 timeout 안에 끝난다는 뜻은 아닙니다.

## 5. 두 호출 경로

- reactive: `chatRoutes.registerChatRoutes` → `reactivePlanner.scheduleReactivePlan` → `ConversationOrchestrator.planForUserMessage` → `messageQueue.queuePlanMessages`
- proactive: `proactiveLoop.runProactiveLoop` → `evaluateProactiveDecision` → `MessageGenerator.inferSilence` → `ConversationOrchestrator.planForSilence` → `messageQueue.queuePlanMessages`

## 스스로 채점하기

- 각 답에 파일명과 함수명이 있다: 2점
- 입력값, 상태 변화, 출력 또는 부작용을 구분했다: 2점
- 정상 흐름과 실패 흐름을 모두 설명했다: 2점
- 추측과 현재 코드에서 확인한 사실을 구분했다: 2점
- 원본을 보지 않고 핵심 순서를 재현했다: 2점

8점 이상이면 실행 흐름을 설명할 수 있는 단계입니다. 10점이어도 실제 수정 전에는 링크된 최신 원본을 다시 확인해야 합니다.
