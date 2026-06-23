# 06. 코드 읽기 순서

## 학습 목표

- 주요 파일을 어떤 순서로 읽어야 전체 흐름이 보이는지 익힌다.
- 각 파일의 입력, 처리, 출력 또는 부작용을 설명한다.
- 코드 한 줄 번역이 아니라 책임과 연결 관계를 중심으로 읽는다.

## 앞 문서와의 연결

[05-core-concepts.md](05-core-concepts.md)에서 핵심 타입과 개념을 봤습니다. 이번에는 실제 코드 파일을 차례로 읽습니다.

## 먼저 생각해 볼 질문

- 백엔드 route 파일은 왜 직접 LLM을 호출하지 않고 planner를 호출할까요?
- 메시지 큐가 별도 파일로 분리된 이유는 무엇일까요?
- 로컬 LLM 서버가 JSON을 못 만들 때 Python과 TypeScript 양쪽에서 어떤 방어가 있나요?

## 1단계: 공통 타입부터 읽기

파일: [../shared/src/index.ts](../shared/src/index.ts)

필요한 이유:

- 프론트, 백엔드, scheduler가 같은 단어를 같은 의미로 쓰게 합니다.

입력:

- 직접 런타임 입력을 받지는 않고 TypeScript 타입을 export합니다.

출력/부작용:

- 컴파일 시 타입 기준을 제공합니다.

확인 질문:

- `OutboundMessageInstruction`과 `MessageRecord`는 왜 다른 타입인가요?

## 2단계: 서버 시작점 읽기

파일: [../backend/src/server.ts](../backend/src/server.ts)

필요한 이유:

- LLM health 확인, Express 앱 생성, Socket.IO 연결, scheduler 시작을 한 곳에서 순서대로 처리합니다.

실패 조건:

- LLM 서버가 준비되지 않으면 시작 전 대기하거나 실패할 수 있습니다.
- 포트가 이미 사용 중이면 listen 단계에서 실패합니다.

직접 바꿔 볼 수 있는 부분:

- 시작 로그 문구 정도는 위험이 작습니다.
- 종료 방식은 `process.exitCode`를 쓰는 현재 구조를 유지하는 편이 좋습니다.

## 3단계: 앱 조립 지점 읽기

파일: [../backend/src/app.ts](../backend/src/app.ts)

필요한 이유:

- store, provider, generator, orchestrator, runtime loop, route를 연결합니다.

입력:

- 선택적으로 테스트용 `adminBitmap`을 받을 수 있습니다.

출력/부작용:

- Express app과 scheduler 시작 함수, socket binding 함수를 반환합니다.
- production에서는 frontend build를 정적 파일로 제공합니다.

확인 질문:

- route 파일들이 직접 `new ConversationOrchestrator`를 하지 않는 이유는 무엇일까요?

## 4단계: 채팅 route 읽기

파일: [../backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts)

필요한 이유:

- HTTP 요청을 검증하고, 인증된 세션에 사용자 메시지를 저장합니다.

중요 처리:

- `TypingSchema`, `MessageSchema`로 payload를 검증합니다.
- 사용자 메시지를 저장하고 socket으로 보냅니다.
- `scheduleReactivePlan`을 호출한 뒤 `202`를 반환합니다.
- 요약 업데이트는 `setImmediate`로 백그라운드 실행합니다.

실패 조건:

- 세션 인증 실패
- payload 검증 실패
- store append 실패

## 5단계: reactive planner 읽기

파일: [../backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts)

필요한 이유:

- 사용자가 더 말할지 잠깐 기다린 뒤, 반응 계획을 실행합니다.

중요 처리:

- 세션별 timer와 sequence를 관리합니다.
- typing이면 재시도합니다.
- `sendCount: 0`이고 더 기다릴 이유가 있으면 다시 예약합니다.
- 너무 오래 기다렸으면 forced plan을 요청합니다.

실패 가능성:

- LLM 호출 실패가 여기서 전파될 수 있습니다.
- timer 로직은 테스트 없이 고치면 회귀가 생기기 쉽습니다.

## 6단계: orchestrator 읽기

파일: [../backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)

필요한 이유:

- 규칙 기반 판단과 LLM 계획 생성을 연결합니다.

중요 처리:

- `likelyUserWillContinue`로 열린 발화를 감지합니다.
- `planForSilence`에서 감정 강도별 침묵 반응을 정합니다.

직접 바꿔 볼 수 있는 부분:

- 열린 발화 판단 정규식
- 고강도 감정 침묵 메시지 문구

## 7단계: message queue 읽기

파일: [../backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts)

필요한 이유:

- plan의 `delayMs`를 실제 타이머로 실행합니다.

중요 처리:

- 새 plan이 오면 기존 세션 timer를 지웁니다.
- 보내기 직전 `isUserTyping`을 다시 확인합니다.
- 메시지 저장 후 socket으로 emit합니다.

## 8단계: proactive loop 읽기

파일: [../backend/src/runtime/proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts)

필요한 이유:

- 사용자의 새 입력이 없어도 active session을 관찰합니다.

중요 처리:

- session마다 독립적으로 try/catch합니다.
- 최근 메시지는 5개만 silence inference에 넘깁니다.
- 성공한 선제 발화는 proactive event로 기록합니다.

## 9단계: 프론트 채팅 화면 읽기

파일: [../frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx)

필요한 이유:

- 사용자 입력, REST 전송, socket 수신, 화면 반영이 모두 모이는 곳입니다.

중요 처리:

- 메시지 전송은 REST
- assistant 메시지 수신은 Socket.IO
- typing 신호는 debounce와 비슷하게 4초 뒤 false 전송

## 10단계: 로컬 LLM 서버 읽기

파일: [../local-llm/server.py](../local-llm/server.py)

필요한 이유:

- 실제 모델 호출과 JSON fallback을 담당합니다.

중요 처리:

- `.env`를 직접 읽습니다.
- GGUF 파일을 검증합니다.
- `LLM_LOCK`으로 동시 생성을 직렬화합니다.
- JSON 추출 실패 시 일부 task에서 안전한 fallback을 만듭니다.

## 실습

1. 위 10단계를 따라 파일을 열고, 각 파일에서 가장 중요한 함수 이름 1개를 적습니다.
2. `POST /api/chat/messages` 흐름에 직접 관여하지 않는 파일을 골라 이유를 설명합니다.
3. `sendCount: 0`이 queue까지 가지 않는 경로를 코드로 추적합니다.
4. `proactiveLoop.ts`의 session별 try/catch가 왜 필요한지 설명합니다.

## 이해 확인 퀴즈

1. 기본: `app.ts`가 composition root인 이유를 설명하세요.
2. 적용: 메시지 전송 직전 typing을 다시 확인하는 이유를 설명하세요.
3. 변형: `reactiveSequence`가 없다면 오래된 timer가 어떤 문제를 만들 수 있나요?
4. 독립 수행: `planForUserMessage`의 간단한 버전을 원본 없이 의사코드로 작성하세요.

해설: [solutions/06-code-walkthrough.md](solutions/06-code-walkthrough.md)

## 핵심 요약

코드는 route, planner, orchestrator, queue, socket, UI로 나뉩니다. 한 파일만 보면 흐름이 끊기므로, 입력이 다음 책임자에게 어떻게 넘어가는지 따라가야 합니다.

다음 문서: [07-data-and-state-flow.md](07-data-and-state-flow.md)
