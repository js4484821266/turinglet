# 06. 코드 워크스루

## 이번 문서의 학습 목표

- 주요 파일을 읽는 순서를 익힌다.
- 핵심 함수의 입력, 처리, 출력 또는 부작용을 설명한다.
- 어디를 고치면 어떤 기능에 영향이 가는지 감을 잡는다.

## 앞 문서와의 연결

[05-core-concepts.md](05-core-concepts.md)에서 개념을 정의했다. 이제 실제 파일을 순서대로 읽는다.

## 먼저 생각해 볼 질문

`createApp`이 모든 코드를 직접 구현하지 않고 여러 모듈을 조립하는 이유는 무엇일까?

## 1. 타입 계약 읽기

파일: [shared/src/index.ts](../shared/src/index.ts)

필요한 이유: 여러 패키지가 같은 데이터 구조를 공유해야 한다.

입력: 없음. 타입 정의 파일이다.

처리: role, presence, session state, message, snapshot, plan, provider adapter type을 선언한다.

반환값/부작용: 런타임 부작용은 없지만 TypeScript 컴파일 시 계약 역할을 한다.

실패 조건: 타입을 바꾸고 backend/frontend/scheduler를 함께 수정하지 않으면 build가 깨지거나 런타임 데이터 해석이 어긋난다.

직접 바꿔 볼 부분: `PresenceState`를 추가하려면 [ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx) 표시 로직과 realtime emit 경로도 함께 확인해야 한다.

## 2. 백엔드 조립 지점

파일: [backend/src/app.ts](../backend/src/app.ts)

필요한 이유: store, provider, generator, orchestrator, routes, runtime을 한 곳에서 연결한다.

입력: 선택적으로 관리자 BMP buffer를 받을 수 있는 `CreateAppOptions`.

처리:

- Express 앱 생성
- store/provider/generator/orchestrator 생성
- realtime emitter, message queue, reactive planner, proactive scheduler 생성
- health, auth, chat, admin routes 등록
- production 정적 파일 서빙 설정

부작용: 관리자 BMP 키 생성, middleware 등록, route 등록.

실패 조건: production build가 없는데 production 모드로 실행하면 frontend dist 누락 오류를 던진다.

## 3. 사용자 메시지 route

파일: [backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts)

필요한 이유: 사용자의 typing과 메시지가 서버로 들어오는 첫 관문이다.

입력:

- `/api/chat/typing`: `{ isTyping }`
- `/api/chat/messages`: `{ content }`

처리:

- session 확인
- zod schema 검증
- 사용자 메시지 append
- Socket.IO로 사용자 메시지 emit
- reactive plan 예약
- background summarization 실행

부작용: DB 저장, realtime emit, timer 예약, emotional snapshot 갱신.

실패 조건: session header 누락, 잘못된 payload, DB 오류, provider summary 실패. summary 실패는 사용자 메시지 전송 자체를 실패로 만들지 않는다.

## 4. 운영 판단

파일: [backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)

필요한 이유: "지금 말할지 말지"를 결정한다.

입력:

- `planForUserMessage`: snapshot, userText
- `planForSilence`: snapshot

처리:

- 사용자가 입력 중이면 `sendCount: 0`
- 이어 말할 가능성이 있으면 `sendCount: 0`
- 그 외에는 provider의 `generateMultiMessagePlan` 호출
- 높은 감정 강도 침묵이면 짧은 공감 메시지

부작용: provider 호출 외에는 크지 않다.

실패 조건: provider 호출 실패, continuation heuristic 과잉 또는 부족.

## 5. reactive planner

파일: [backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts)

필요한 이유: 사용자 메시지 직후 바로 답하지 않고, continuation grace와 typing 상태를 반영한다.

입력: sessionId, userText, attempt, sequence, startedAt.

처리:

- 기존 timer 정리
- 처음에는 `userContinuationGraceMs`만큼 기다림
- typing이면 재시도
- plan이 `sendCount: 0`이고 최대 대기 전이면 재시도
- 최대 대기 후에는 provider plan을 강제로 받아 queue에 넣음

부작용: timer 생성, presence emit, message queue 호출.

## 6. message queue

파일: [backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts)

필요한 이유: 여러 메시지를 delay에 맞춰 보내고, 발송 직전에 typing을 다시 확인한다.

입력: sessionId, messages, source.

처리:

- 해당 session의 기존 timers 정리
- 각 메시지를 `delayMs`로 예약
- 발송 직전 `isUserTyping` 확인
- assistant message append
- Socket.IO emit

부작용: timer, DB 저장, realtime emit.

실패 조건: timer는 메모리 기반이므로 서버 재시작 시 예약 메시지는 사라진다.

## 7. proactive 판단

파일: [scheduler/src/index.ts](../scheduler/src/index.ts)

필요한 이유: backend 밖에서도 테스트하기 쉬운 순수 판단 로직이다.

입력: snapshot, now, lastOutreachAt, minSilenceMs, cooldownMs.

처리:

- typing이면 거절
- 사용자 발화가 없으면 거절
- 침묵 시간이 짧으면 거절
- cooldown 중이면 거절
- 조건 통과 시 선제 발화 후보로 승인

반환값: `ProactiveDecision`.

## 관찰 실습

1. 위 순서대로 파일을 열고, 각 파일에서 가장 중요한 함수 이름을 하나씩 적는다.
2. [reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts)의 `attempt < 20` 조건을 찾고, 왜 무한 재시도를 피해야 하는지 설명한다.
3. [messageQueue.ts](../backend/src/runtime/messageQueue.ts)의 `source` metadata가 reactive/proactive 구분에 어떻게 쓰일 수 있는지 생각한다.

## 자주 헷갈리는 부분

`MessageGenerator`와 `ConversationOrchestrator`는 모두 engine 폴더에 있지만 역할이 다르다. generator는 LLM을 통해 텍스트나 요약을 만들고, orchestrator는 운영 정책을 적용한다.

## 이해 확인 질문

- `createApp`에서 route 등록 전에 queue와 planner를 만드는 이유는 무엇인가?
- background summarization이 실패해도 사용자 메시지 전송을 실패로 만들지 않는 이유는 무엇인가?
- `clearSessionTimers`가 새 plan을 받을 때 호출되는 이유는 무엇인가?

## 핵심 요약

코드를 읽을 때는 타입, 조립, route, 운영 판단, timer, queue 순서가 가장 안정적이다. 이 순서가 사용자 입력이 assistant 메시지로 변하는 실제 순서와도 가깝다.

다음 문서: [07-data-and-state-flow.md](07-data-and-state-flow.md)
