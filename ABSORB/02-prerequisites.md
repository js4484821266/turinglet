# 02. 선수 지식과 실행 준비

## 이번 문서의 학습 목표

- 코드를 읽기 전에 필요한 개념을 정리한다.
- 실행에 필요한 Node, Python, 환경 변수, 모델 파일의 역할을 구분한다.
- 의존성 문제와 코드 문제를 섞어 판단하지 않는 기준을 세운다.

## 앞 문서와의 연결

[01-problem-and-goals.md](01-problem-and-goals.md)에서 프로젝트 목표를 봤다. 이제 그 목표를 구현한 코드를 읽기 위해 필요한 배경을 준비한다.

## 먼저 생각해 볼 질문

브라우저에서 메시지를 보내는 것과 서버가 assistant 메시지를 나중에 보내는 것은 같은 HTTP 요청 안에서 처리될까, 아니면 다른 경로로 처리될까?

## 알아야 할 개념

| 개념 | 이 프로젝트에서의 의미 | 먼저 볼 파일 |
| --- | --- | --- |
| npm workspace | 여러 패키지를 하나의 repo에서 빌드하고 실행한다. | [package.json](../package.json) |
| TypeScript type contract | frontend, backend, scheduler가 공유하는 데이터 모양이다. | [shared/src/index.ts](../shared/src/index.ts) |
| REST API | 사용자 메시지 저장, typing 전송, 인증 요청에 사용한다. | [backend/src/routes](../backend/src/routes) |
| Socket.IO | assistant 메시지와 presence 업데이트를 실시간으로 받는다. | [backend/src/runtime/realtime.ts](../backend/src/runtime/realtime.ts) |
| timer | 즉시 답하지 않고 일정 시간 뒤 계획을 실행한다. | [reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts) |
| SQLite migration | 테이블 구조를 한 파일에서 만든다. | [database/migrations/001_init.sql](../database/migrations/001_init.sql) |
| local LLM | 백엔드가 호출하는 로컬 FastAPI 모델 서버다. | [local-llm/server.py](../local-llm/server.py) |

## 실행 준비

루트 명령은 [package.json](../package.json)을 기준으로 한다.

```powershell
npm install
npm run migrate
npm run dev
```

로컬 LLM까지 실행하려면 Python venv와 로컬 GGUF 모델이 필요하다.

```powershell
python -m venv .venv-llm
.\.venv-llm\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r local-llm/requirements.txt
```

모델은 자동 다운로드하지 않는 정책을 유지한다. [.env.example](../.env.example)의 `HF_MODEL_PATH`가 유효한 `.gguf` 파일을 가리켜야 한다.

```env
HF_MODEL_PATH=./local-llm/models/qwen2.5-0.5b-instruct-q4_k_m.gguf
```

## 실행 명령과 의미

| 명령 | 의미 | 주의 |
| --- | --- | --- |
| `npm run build` | shared, scheduler, database, backend, frontend를 순서대로 빌드한다. | 타입 오류를 넓게 확인한다. |
| `npm test` | backend Vitest 테스트를 실행한다. | 환경에 따라 esbuild 실행 권한 문제가 날 수 있다. |
| `npm run migrate` | SQLite migration을 적용한다. | DB 경로는 환경 변수와 database 유틸을 확인한다. |
| `npm run dev` | backend와 frontend 개발 서버를 함께 실행한다. | LLM 서버는 별도로 필요하다. |
| `npm run dev:llm:windows` | Windows에서 LLM 서버와 앱을 함께 실행한다. | `.venv-llm`과 모델 파일이 필요하다. |

## 관찰 실습

1. [package.json](../package.json)의 `predev`를 읽고, `npm run dev` 전에 어떤 패키지가 빌드되는지 적는다.
2. [.env.example](../.env.example)에서 `PROACTIVE_MIN_SILENCE_MS`, `PROACTIVE_COOLDOWN_MS`, `HF_CONTEXT_SIZE`를 찾는다.
3. [local-llm/server.py](../local-llm/server.py)가 모델 파일을 못 찾으면 어떤 계열의 문제가 생길지 README의 실행 안내와 연결해 설명한다.

## 예상 결과와 확인 방법

`npm run build`가 성공하면 TypeScript 패키지 간 타입 계약은 대체로 맞는 상태다. `npm test`가 성공하면 정책, QR 인증, 관리자 인증의 일부 핵심 경로가 검증된다. 단, 로컬 LLM 품질과 실제 브라우저 UI 동작은 별도 수동 확인이 필요하다.

## 자주 헷갈리는 부분

`npm run dev`가 실행된다고 해서 로컬 LLM이 준비됐다는 뜻은 아니다. backend는 시작 전 [backend/src/runtime/llmHealth.ts](../backend/src/runtime/llmHealth.ts)를 통해 LLM health를 기다린다.

## 이해 확인 질문

- `shared` 패키지가 없으면 frontend와 backend 사이에 어떤 문제가 생기기 쉬운가?
- `HF_MODEL_PATH`가 없을 때 mock fallback을 넣지 않는 이유는 무엇인가?
- Socket.IO가 REST API를 완전히 대체하지 않는 이유는 무엇인가?

## 핵심 요약

실행 준비는 Node 의존성, DB migration, Python LLM 서버, 로컬 모델 파일로 나뉜다. 오류가 나면 어느 층의 문제인지 먼저 분리해서 본다.

다음 문서: [03-project-map.md](03-project-map.md)
