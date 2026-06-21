# 04. 핵심 컴포넌트

## 이번 문서의 학습 목표

이 문서는 삼마고를 구성하는 주요 파일, 클래스, 함수, 타입의 역할을 설명한다. 목표는 코드를 고칠 때 어디를 먼저 읽고 어떤 계약을 지켜야 하는지 판단하는 것이다.

## 앞 문서와의 연결

[03-execution-flow.md](03-execution-flow.md)에서는 실행 흐름을 봤다. 이제 그 흐름을 실제로 담당하는 컴포넌트를 파일별로 정리한다.

## 공유 타입

[shared/src/index.ts](../shared/src/index.ts)는 모듈 사이의 언어를 맞추는 파일이다.

| 식별자 | 역할 |
| --- | --- |
| `Role` | `user`, `assistant`, `system` 메시지 역할 |
| `PresenceState` | assistant가 `typing`, `thinking`, `organizing`, `waiting` 중 어디에 있는지 |
| `SessionMachineState` | 대화 상태 기계의 현재 상태 |
| `SilenceMeaning` | 침묵 의미 후보 |
| `MessageRecord` | DB와 socket에서 공통으로 쓰는 메시지 형태 |
| `ConversationSnapshot` | planner가 판단할 때 필요한 세션 요약 |
| `OutboundMessageInstruction` | 전송할 assistant 메시지 한 조각과 delay |
| `MultiMessagePlan` | 여러 메시지로 나뉠 수 있는 assistant 반응 계획 |
| `LLMProviderAdapter` | backend가 LLM provider에게 기대하는 interface |
| `ProactiveDecisionInput` | scheduler가 선제 발화 가능성을 판단할 때 받는 값 |

이 파일을 바꾸면 프론트, 백엔드, 스케줄러, provider 검증 로직이 함께 영향을 받는다.

## 백엔드 조립 지점

[backend/src/app.ts](../backend/src/app.ts)는 다음 의존성을 만든다.

- `store`: [createStore](../backend/src/db/index.ts)로 SQLite 또는 PostgreSQL 선택
- `provider`: [createProvider](../backend/src/adapters/index.ts)로 local LLM provider 생성
- `generator`: [MessageGenerator](../backend/src/engine/messageGenerator.ts)
- `orchestrator`: [ConversationOrchestrator](../backend/src/engine/orchestrator.ts)
- `queue`: [createMessageQueue](../backend/src/runtime/messageQueue.ts)
- `reactive`: [createReactivePlanner](../backend/src/runtime/reactivePlanner.ts)
- `proactive`: [createProactiveScheduler](../backend/src/runtime/proactiveLoop.ts)
- routes: auth, chat, admin

이 파일은 기능을 직접 많이 구현하기보다, 작게 나뉜 모듈을 연결하는 역할을 한다.

## 라우트 컴포넌트

| 파일 | 역할 |
| --- | --- |
| [authRoutes.ts](../backend/src/routes/authRoutes.ts) | QR 가입, QR 로그인, 복구 QR 발급 |
| [chatRoutes.ts](../backend/src/routes/chatRoutes.ts) | typing 저장, 메시지 조회, 사용자 메시지 저장 |
| [adminRoutes.ts](../backend/src/routes/adminRoutes.ts) | 관리자 BMP 로그인, overview, 세션 메시지 조회 |
| [sessionAuth.ts](../backend/src/routes/sessionAuth.ts) | `x-session-id` 기반 세션 확인 |
| [schemas.ts](../backend/src/routes/schemas.ts) | Zod 요청 payload 검증 |

라우트는 요청 검증과 응답 코드 결정에 집중한다. 대화 timing 정책은 route 안에 넣지 않고 runtime과 engine으로 넘긴다.

## Runtime 컴포넌트

| 파일 | 역할 |
| --- | --- |
| [reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts) | 사용자 메시지 후 응답 계획을 예약하고 재시도한다. |
| [proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts) | active session을 주기적으로 훑고 선제 발화 조건을 검사한다. |
| [messageQueue.ts](../backend/src/runtime/messageQueue.ts) | plan의 delay에 맞춰 assistant 메시지를 저장하고 socket으로 보낸다. |
| [realtime.ts](../backend/src/runtime/realtime.ts) | Socket.IO room join과 message/presence emit을 담당한다. |
| [llmHealth.ts](../backend/src/runtime/llmHealth.ts) | 백엔드 시작 전 local LLM `/health`를 기다린다. |

Runtime 계층은 timer와 socket처럼 "시간에 따라 일어나는 일"을 다룬다.

## Engine 컴포넌트

[backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)의 `ConversationOrchestrator`는 두 가지 계획을 만든다.

- `planForUserMessage`: 사용자 메시지 직후 reactive 응답 계획
- `planForSilence`: 침묵이 길어졌을 때 proactive 응답 계획

`likelyUserWillContinue`는 짧은 조각 문장, 연결어 꼬리, 열린 어미, 말줄임표 등을 보고 사용자가 더 말할 가능성을 판단한다.

[backend/src/engine/messageGenerator.ts](../backend/src/engine/messageGenerator.ts)의 `MessageGenerator`는 provider 호출을 얇게 감싸며, 현재는 silence meaning 추론에 주로 쓰인다.

## Adapter 컴포넌트

[backend/src/adapters/hfLocalProvider.ts](../backend/src/adapters/hfLocalProvider.ts)는 backend가 local LLM 서버를 호출하는 유일한 통로다. `/v1/generate` 요청을 보내고, 결과가 실패하면 Error를 던진다.

[backend/src/adapters/hfLocalValidation.ts](../backend/src/adapters/hfLocalValidation.ts)는 LLM이 반환한 `MultiMessagePlan`이 공유 타입에 맞는지 정규화한다. presence와 session state enum도 여기서 검증한다.

## Store 컴포넌트

[backend/src/db/types.ts](../backend/src/db/types.ts)의 `Store` interface는 인증, 세션, 메시지, typing, proactive event, snapshot, 관리자 조회 기능을 모두 정의한다.

구현은 두 가지다.

- [SqliteStore](../backend/src/db/sqliteStore.ts): 기본 로컬 실행
- [PostgresStore](../backend/src/db/postgresStore.ts): 선택 실행

SQLite 세부 query는 `sqliteAuth`, `sqliteMessages`, `sqlitePresenceEvents`, `sqliteSessions`, `sqliteAdmin`으로 나뉘어 있다. PostgreSQL도 비슷한 분리 구조를 가진다.

## Frontend 컴포넌트

| 파일 | 역할 |
| --- | --- |
| [App.tsx](../frontend/src/App.tsx) | `/achrai/`, 세션 유무에 따라 화면 선택 |
| [AuthPanel.tsx](../frontend/src/components/AuthPanel.tsx) | QR 가입, QR 로그인, QR 이미지 스캔 |
| [ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx) | 메시지 전송, socket 수신, typing 전송 |
| [AdminPanel.tsx](../frontend/src/components/AdminPanel.tsx) | 관리자 BMP 로그인, overview와 세션 메시지 조회 |
| [store.ts](../frontend/src/store.ts) | 세션, QR, 메시지, presence 상태 |
| [api.ts](../frontend/src/api.ts) | backend origin과 API 타입 |

## Local LLM 컴포넌트

[local-llm/server.py](../local-llm/server.py)는 다음 task를 처리한다.

| task | 반환 |
| --- | --- |
| `single_message` | 짧은 단일 메시지 |
| `multi_plan` | `MultiMessagePlan` 형태의 JSON 또는 fallback plan |
| `summary` | 감정 강도와 한 줄 요약 |
| `silence_meaning` | 침묵 의미 enum |

서버 시작 시 `HF_MODEL_PATH`가 비어 있거나 유효한 `.gguf` 파일이 아니면 실패한다.

## 자주 헷갈리는 부분

`MessageGenerator.createSingle`은 존재하지만 현재 핵심 reactive 응답은 `ConversationOrchestrator`가 provider의 `generateMultiMessagePlan`을 호출하는 흐름이다. 기능을 추가할 때 "문장 하나 생성"과 "여러 메시지 계획 생성"의 차이를 유지해야 한다.

## 반드시 이해해야 할 요점

- 타입은 `shared`, 정책은 `engine`, 시간 제어는 `runtime`, HTTP 요청은 `routes`가 담당한다.
- `Store` interface를 지키면 SQLite와 PostgreSQL 구현을 바꿔도 상위 코드는 같은 방식으로 동작한다.
- frontend는 DB와 LLM을 직접 알지 않고 API와 socket event만 본다.

## 다음 문서

다음은 [05-data-flow.md](05-data-flow.md)에서 데이터가 저장되고 변환되는 흐름을 배운다.

