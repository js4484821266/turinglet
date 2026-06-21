# ABSORB 학습교재

이 교재는 삼마고(Saammaago) 프로젝트를 처음부터 끝까지 흡수하기 위한 순차 학습 문서다. 루트의 [README.md](../README.md)가 실행 방법과 프로젝트 소개를 설명한다면, 이 `ABSORB/` 문서는 현재 구현된 코드가 왜 이런 구조를 갖는지, 어떤 흐름으로 동작하는지, 유지보수할 때 무엇을 지켜야 하는지를 단계적으로 설명한다.

기존 단일 분석 문서인 [ABSORB.md](../ABSORB.md)는 삭제하지 않고 보존했다. 새 교재는 그 내용을 읽은 뒤 현재 `AGENTS.md` 규칙에 맞춰 `ABSORB/README.md`에서 시작하는 학습 순서로 재구성한 것이다.

## 학습 대상과 선수 지식

이 교재는 React, TypeScript, Node.js, Express, Socket.IO, SQLite, Python FastAPI를 한 프로젝트 안에서 어떻게 연결하는지 배우려는 사람을 대상으로 한다. 모든 세부 문법을 이미 알고 있어야 하는 것은 아니지만, HTTP API, 비동기 처리, npm workspace, SQL 테이블의 기본 개념은 알고 있으면 읽기 쉽다.

## 완성된 프로젝트 요약

삼마고는 사용자의 말에 바로 한 번 답하는 턴제 챗봇이 아니라, 사용자가 입력 중인지, 침묵이 얼마나 길어졌는지, 감정 강도가 높은지, 최근에 먼저 말을 걸었는지를 보고 "언제, 몇 개의 메시지로, 어떤 부담 수준으로 말할지"를 조절하는 AI 말동무 프로토타입이다. 프론트엔드는 QR 기반 가입/로그인과 실시간 채팅 UI를 제공하고, 백엔드는 메시지를 저장한 뒤 reactive planner, proactive scheduler, local LLM provider, message queue를 조합해 지연 응답과 선제 발화를 실행한다.

## 전체 학습 순서

| 순서 | 문서 | 배우는 내용 |
| --- | --- | --- |
| 1 | [01-project-overview.md](01-project-overview.md) | 프로젝트 목적, 최종 결과, 기존 챗봇과의 차이 |
| 2 | [02-architecture.md](02-architecture.md) | 모노레포 구조, 패키지 책임, 큰 의존 관계 |
| 3 | [03-execution-flow.md](03-execution-flow.md) | 앱 시작, 인증, reactive 응답, proactive 발화 흐름 |
| 4 | [04-core-components.md](04-core-components.md) | 주요 모듈, 함수, 클래스, 식별자의 역할 |
| 5 | [05-data-flow.md](05-data-flow.md) | DB 테이블, 메시지 저장, snapshot, 환경 변수 흐름 |
| 6 | [06-implementation-details.md](06-implementation-details.md) | 핵심 알고리즘과 구현 판단 |
| 7 | [07-testing-and-debugging.md](07-testing-and-debugging.md) | 테스트 전략, 검증 명령, 자주 나는 오류 |
| 8 | [08-extension-and-maintenance.md](08-extension-and-maintenance.md) | 확장 지점, 유지보수 기준, 피해야 할 변경 |
| 9 | [09-interview-and-portfolio.md](09-interview-and-portfolio.md) | 면접, 포트폴리오, 이력서에서 설명하는 방법 |

## 실행에 필요한 환경

주요 환경은 루트 [package.json](../package.json)과 [.env.example](../.env.example)을 기준으로 한다.

| 영역 | 필요 요소 |
| --- | --- |
| Node.js | Node.js 20 이상, npm workspace |
| Frontend | React, Vite, Zustand, Socket.IO client |
| Backend | Express, Socket.IO, Zod, better-sqlite3 또는 pg |
| Database | 기본 SQLite, 선택 PostgreSQL |
| Local LLM | Python venv, FastAPI, llama-cpp-python, GGUF 모델 파일 |
| Test | Vitest, Supertest |

로컬 개발의 기본 명령은 다음과 같다.

```bash
npm install
npm run migrate
npm run dev
```

로컬 GGUF LLM 서버까지 함께 실행하려면 운영체제에 맞게 다음 명령을 사용한다.

```powershell
npm run dev:llm:windows
```

```bash
npm run dev:llm:debian
```

## 주요 코드와 산출물 링크

| 범위 | 링크 |
| --- | --- |
| 프로젝트 소개 | [README.md](../README.md) |
| 루트 실행 명령 | [package.json](../package.json) |
| 환경 변수 예시 | [.env.example](../.env.example) |
| 공유 타입 | [shared/src/index.ts](../shared/src/index.ts) |
| 백엔드 조립 지점 | [backend/src/app.ts](../backend/src/app.ts) |
| 백엔드 서버 진입점 | [backend/src/server.ts](../backend/src/server.ts) |
| 채팅 route | [backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts) |
| 반응 정책 | [backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts) |
| reactive planner | [backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts) |
| proactive scheduler | [backend/src/runtime/proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts) |
| 선제 발화 판단 | [scheduler/src/index.ts](../scheduler/src/index.ts) |
| React 앱 | [frontend/src/App.tsx](../frontend/src/App.tsx) |
| 채팅 UI | [frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx) |
| DB schema | [database/migrations/001_init.sql](../database/migrations/001_init.sql) |
| Local LLM 서버 | [local-llm/server.py](../local-llm/server.py) |
| 프롬프트 설계 자료 | [prompt-engineering/](../prompt-engineering/) |

## 권장 학습 방법

먼저 [01-project-overview.md](01-project-overview.md)에서 프로젝트가 해결하려는 문제를 잡고, [02-architecture.md](02-architecture.md)에서 큰 폴더 구조를 본다. 그다음 [03-execution-flow.md](03-execution-flow.md)를 읽으며 사용자가 메시지를 보낸 뒤 실제 assistant 메시지가 늦게 도착하는 이유를 따라간다. 이후 [04-core-components.md](04-core-components.md)와 [05-data-flow.md](05-data-flow.md)에서 주요 파일과 데이터 저장 방식을 확인하고, [06-implementation-details.md](06-implementation-details.md)에서 정책과 알고리즘을 읽는다. 마지막으로 테스트, 유지보수, 포트폴리오 설명 문서를 순서대로 읽으면 된다.

핵심은 "무엇을 말할지"와 "언제 말할지"가 분리되어 있다는 점이다. 이 기준을 놓치지 않으면 코드의 각 폴더가 왜 분리되어 있는지 이해하기 쉽다.

