# 03. 프로젝트 지도

## 학습 목표

- repo의 최상위 디렉터리 역할을 설명한다.
- workspace 패키지들이 어떤 의존 관계로 연결되는지 이해한다.
- 코드를 수정할 때 어느 영역을 먼저 봐야 하는지 판단한다.

## 앞 문서와의 연결

[02-prerequisites.md](02-prerequisites.md)에서 실행 단위를 봤습니다. 이번 문서에서는 그 실행 단위가 실제 파일 구조 안에 어디에 있는지 확인합니다.

## 먼저 생각해 볼 질문

- 메시지 타입을 바꾸려면 프론트와 백엔드 중 어디만 고치면 될까요?
- 선제 발화 정책을 바꾸는 코드는 백엔드 라우트에 있을까요, scheduler 패키지에 있을까요?
- DB 테이블을 바꾸면 어떤 문서와 테스트도 같이 확인해야 할까요?

## 최상위 구조

```text
turinglet/
├── backend/              # Express API, Socket.IO, engine, DB store 구현
├── database/             # migration, seed, DB 패키지 진입점
├── frontend/             # React/Vite UI와 Electron 진입점
├── local-llm/            # Python FastAPI + llama-cpp-python 서버
├── prompt-engineering/   # 대화 정책 프롬프트 기록
├── scheduler/            # 선제 발화 가능 여부를 판단하는 순수 로직
├── shared/               # 공통 TypeScript 타입
├── deploy/               # 클라우드 배포 스크립트
├── ABSORB/               # 지금 읽는 학습 교재
├── README.md             # 실행과 프로젝트 소개
├── AGENTS.md             # 이 repo에서 AI 에이전트가 지킬 작업 규칙
└── package.json          # npm workspace와 루트 스크립트
```

## 패키지 관계

```text
frontend
  -> backend API/Socket.IO를 호출
  -> frontend/src/api.ts의 타입 일부 사용

backend
  -> shared 타입 사용
  -> scheduler의 evaluateProactiveDecision 사용
  -> database 스키마와 store 구현 사용
  -> local-llm 서버를 HTTP로 호출

scheduler
  -> shared 타입 사용

database
  -> migration 파일로 테이블 생성

local-llm
  -> 백엔드의 provider가 호출하는 별도 Python 서버
```

## 주요 파일별 역할

| 파일 | 역할 | 먼저 볼 상황 |
| --- | --- | --- |
| [../backend/src/app.ts](../backend/src/app.ts) | 백엔드 의존성을 조립한다. | API, socket, scheduler 연결을 보고 싶을 때 |
| [../backend/src/server.ts](../backend/src/server.ts) | LLM health 대기 후 HTTP 서버를 시작한다. | 앱이 시작되지 않을 때 |
| [../backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts) | 채팅 메시지, typing API를 처리한다. | 사용자 메시지 전송 흐름을 볼 때 |
| [../backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts) | 사용자 메시지에 대한 반응 계획을 지연 실행한다. | 즉시 답변/대기 정책을 바꿀 때 |
| [../backend/src/runtime/proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts) | 긴 침묵 세션을 주기적으로 검사한다. | 먼저 말 걸기 조건을 바꿀 때 |
| [../backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts) | 계획된 여러 메시지를 delay에 맞춰 보낸다. | 메시지 간격과 중단 조건을 볼 때 |
| [../backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts) | 규칙 기반 판단과 LLM 계획 요청을 연결한다. | "기다릴지 답할지" 판단을 볼 때 |
| [../frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx) | 채팅 UI, REST 전송, socket 수신을 담당한다. | 화면에서 메시지가 안 보일 때 |
| [../local-llm/server.py](../local-llm/server.py) | 로컬 모델로 메시지 계획과 요약을 생성한다. | LLM 응답 형식 문제가 있을 때 |
| [../database/migrations/001_init.sql](../database/migrations/001_init.sql) | 영속 데이터 구조를 정의한다. | 저장되는 값의 출처를 볼 때 |

## 수정 위치 고르기

작은 요구사항을 받았을 때 바로 코드를 고치기보다, 어느 층의 책임인지 먼저 나눕니다.

| 요구사항 | 우선 확인 위치 |
| --- | --- |
| "사용자가 입력 중이면 더 오래 기다리게 해줘" | [../backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts), [../backend/src/config.ts](../backend/src/config.ts) |
| "긴 침묵 후 먼저 말 거는 간격을 늘려줘" | [../scheduler/src/index.ts](../scheduler/src/index.ts), [../backend/src/config.ts](../backend/src/config.ts) |
| "메시지 말풍선 표시를 바꿔줘" | [../frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx), [../frontend/src/styles/chat.css](../frontend/src/styles/chat.css) |
| "QR 로그인 복원을 바꿔줘" | [../backend/src/routes/authRoutes.ts](../backend/src/routes/authRoutes.ts), [../frontend/src/components/AuthPanel.tsx](../frontend/src/components/AuthPanel.tsx) |
| "DB에 새 기록을 남겨줘" | [../database/migrations/001_init.sql](../database/migrations/001_init.sql), [../backend/src/db/store.ts](../backend/src/db/store.ts) |

## 실습

1. `rg "generateMultiMessagePlan"`로 어떤 파일들이 LLM 계획을 호출하는지 찾아봅니다.
2. `rg "proactive"`로 선제 발화 관련 파일을 찾아 역할별로 분류합니다.
3. `rg "sessionId"`로 세션이 프론트, API, DB를 어떻게 통과하는지 관찰합니다.

예상 결과:

- LLM 계획 호출은 provider 인터페이스와 orchestrator를 거쳐 나타납니다.
- proactive라는 단어는 scheduler, runtime loop, DB 이벤트 기록에 걸쳐 나타납니다.
- `sessionId`는 인증 이후 대화 스트림을 구분하는 핵심 키입니다.

## 이해 확인 퀴즈

1. 기본: `shared` 패키지가 필요한 이유를 설명하세요.
2. 적용: 선제 발화 조건을 테스트하려면 어떤 패키지의 어떤 함수를 우선 보면 되나요?
3. 변형: 프론트에서 presence 문구만 바꾸려면 백엔드를 수정해야 할까요?
4. 독립 수행: "메시지 지연 전송" 요구사항을 담당하는 파일을 찾는 과정을 단계별로 적으세요.

해설: [solutions/03-project-map.md](solutions/03-project-map.md)

## 핵심 요약

삼마고는 하나의 큰 파일이 아니라, UI, API, runtime, engine, scheduler, LLM 서버, DB가 역할별로 나뉜 구조입니다. 수정 전에 책임 경계를 먼저 찾는 것이 안전합니다.

다음 문서: [04-execution-flow.md](04-execution-flow.md)
