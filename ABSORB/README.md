# ABSORB 학습교재

이 폴더는 삼마고(Saammaago) 프로젝트의 코드를 읽고, 실행 흐름을 따라가고, 작은 수정을 직접 해 보면서 구현 방식을 자기 지식으로 흡수하기 위한 순차 학습교재다. 루트 [README.md](../README.md)가 실행 안내와 프로젝트 소개라면, 이 교재는 현재 코드가 왜 이런 구조인지 설명한다.

기존 분석 자료는 [archive/ABSORB.md](../archive/ABSORB.md)와 [archive/ABSORB/](../archive/ABSORB/)에 보존되어 있다. 새 교재는 `AGENTS.md`의 현재 규칙에 맞춰 최상위 `ABSORB/README.md`에서 시작하는 구조로 재편성했다.

## 교재의 목적

완성품처럼 프로젝트를 홍보하는 것이 아니라, 사용자가 다음을 할 수 있게 만드는 것이 목적이다.

- 삼마고가 해결하려는 문제를 자기 말로 설명한다.
- frontend, backend, shared, database, scheduler, local-llm의 역할을 구분한다.
- 사용자의 입력이 저장되고, 지연 응답과 선제 발화로 이어지는 흐름을 추적한다.
- 핵심 정책을 읽고, 왜 사용자가 입력 중일 때 AI가 끼어들면 안 되는지 설명한다.
- 작은 기능을 수정하거나 핵심 흐름을 빈 파일에서 다시 구현한다.
- 면접이나 포트폴리오에서 과장 없이 기술 선택을 설명한다.

## 학습 대상과 선수 지식

대상은 React, TypeScript, Node.js, Express, Socket.IO, SQLite, Python FastAPI가 한 프로젝트에서 어떻게 연결되는지 배우려는 사람이다. 모든 라이브러리의 세부 문법을 미리 알 필요는 없지만, HTTP API, 비동기 타이머, npm workspace, SQL 테이블, 환경 변수의 기본 개념은 알고 있으면 좋다.

## 프로젝트 한 문장 소개

삼마고는 상담 서비스가 아니라, 사용자가 정리되지 않은 말이나 기분도 부담 낮게 털어놓을 수 있는 AI 말동무 프로토타입이다. 핵심은 답변 내용만 생성하는 것이 아니라, 타이핑 상태, 침묵 시간, 감정 강도, 쿨다운을 보고 "언제, 몇 개의 메시지로, 어떤 부담 수준으로 말할지"를 조절하는 것이다.

## 전체 학습 순서

| 순서 | 문서 | 배우는 내용 |
| --- | --- | --- |
| 1 | [01-problem-and-goals.md](01-problem-and-goals.md) | 프로젝트가 해결하려는 문제와 설계 목표 |
| 2 | [02-prerequisites.md](02-prerequisites.md) | 읽기 전에 필요한 개념과 실행 환경 |
| 3 | [03-project-map.md](03-project-map.md) | 디렉터리, 패키지, 주요 파일 지도 |
| 4 | [04-execution-flow.md](04-execution-flow.md) | 앱 시작, 인증, reactive/proactive 실행 흐름 |
| 5 | [05-core-concepts.md](05-core-concepts.md) | presence, snapshot, plan, queue, provider 개념 |
| 6 | [06-code-walkthrough.md](06-code-walkthrough.md) | 핵심 파일과 함수의 역할 |
| 7 | [07-data-and-state-flow.md](07-data-and-state-flow.md) | DB, 상태 변화, 메시지 저장 흐름 |
| 8 | [08-debugging-and-testing.md](08-debugging-and-testing.md) | 테스트 명령, 오류 원인 좁히기 |
| 9 | [09-guided-modifications.md](09-guided-modifications.md) | 작은 수정 실습과 확인 방법 |
| 10 | [10-reimplementation.md](10-reimplementation.md) | 핵심 정책을 빈 파일에서 다시 구현하는 연습 |
| 11 | [11-explain-it-yourself.md](11-explain-it-yourself.md) | 자기 말로 설명하기, 면접 질문 |

## 실행 환경

기본 실행 표면은 루트 [package.json](../package.json)의 npm scripts다. 환경 변수 예시는 [.env.example](../.env.example)을 기준으로 한다.

| 영역 | 필요 요소 |
| --- | --- |
| Node.js | Node.js 20 이상, npm workspace |
| Frontend | React, Vite, Zustand, socket.io-client |
| Backend | Express, Socket.IO, Zod, better-sqlite3 또는 pg |
| Database | 기본 SQLite, 선택 PostgreSQL store |
| Local LLM | Python venv, FastAPI, llama-cpp-python, 로컬 GGUF 모델 |
| Test | Vitest, Supertest |

기본 명령:

```powershell
npm install
npm run migrate
npm run dev
```

로컬 GGUF LLM까지 함께 실행:

```powershell
npm run dev:llm:windows
```

```bash
npm run dev:llm:debian
```

## 원본 코드와 주요 산출물

| 범위 | 링크 |
| --- | --- |
| 프로젝트 소개 | [README.md](../README.md) |
| 루트 실행 명령 | [package.json](../package.json) |
| 환경 변수 예시 | [.env.example](../.env.example) |
| 공유 타입 계약 | [shared/src/index.ts](../shared/src/index.ts) |
| 백엔드 조립 지점 | [backend/src/app.ts](../backend/src/app.ts) |
| 백엔드 서버 진입점 | [backend/src/server.ts](../backend/src/server.ts) |
| 채팅 API | [backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts) |
| 응답 정책 | [backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts) |
| reactive planner | [backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts) |
| proactive loop | [backend/src/runtime/proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts) |
| message queue | [backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts) |
| 선제 발화 판단 | [scheduler/src/index.ts](../scheduler/src/index.ts) |
| React 앱 | [frontend/src/App.tsx](../frontend/src/App.tsx) |
| 채팅 UI | [frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx) |
| DB schema | [database/migrations/001_init.sql](../database/migrations/001_init.sql) |
| 로컬 LLM 서버 | [local-llm/server.py](../local-llm/server.py) |
| 프롬프트 설계 자료 | [prompt-engineering/](../prompt-engineering/) |

## 권장 학습 방법

문서를 순서대로 읽되, 각 문서에서 링크된 실제 파일을 반드시 함께 열어 본다. 설명을 읽은 뒤에는 "이 함수가 받는 입력, 내부 처리, 반환값 또는 부작용, 실패 조건"을 자기 말로 한 번 써 본다.

진도 확인 기준은 단순히 문서를 다 읽는 것이 아니다. [09-guided-modifications.md](09-guided-modifications.md)의 작은 수정 실습과 [10-reimplementation.md](10-reimplementation.md)의 재구현 연습을 해 보고, [11-explain-it-yourself.md](11-explain-it-yourself.md)의 질문에 코드 링크를 짚으며 답할 수 있어야 한다.

다음 문서: [01-problem-and-goals.md](01-problem-and-goals.md)
