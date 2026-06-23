# 02. 선수 지식과 실행 환경

## 학습 목표

- 로컬 실행에 필요한 Node.js, Python, GGUF 모델, `.env` 설정의 역할을 설명한다.
- 의존성 문제와 코드 문제를 분리해서 볼 수 있다.
- 자동 다운로드 없이 로컬 모델 경로를 명시해야 하는 이유를 이해한다.

## 앞 문서와의 연결

[01-problem-and-goals.md](01-problem-and-goals.md)에서 삼마고의 목표를 봤습니다. 이제 그 목표를 실행하기 위해 어떤 프로그램들이 동시에 필요한지 확인합니다.

## 먼저 생각해 볼 질문

- 프론트엔드 서버가 떠 있어도 로컬 LLM 서버가 없으면 어떤 기능이 막힐까요?
- `.env`에 들어가는 값 중 Git에 커밋하면 안 되는 것은 무엇일까요?
- 모델 파일 다운로드 실패와 TypeScript 컴파일 실패는 같은 종류의 문제일까요?

## 필요한 실행 단위

삼마고는 하나의 프로세스가 아니라 여러 실행 단위가 함께 움직입니다.

| 실행 단위 | 주요 파일 | 역할 |
| --- | --- | --- |
| Frontend | [../frontend/src/App.tsx](../frontend/src/App.tsx) | 화면 선택, 채팅 UI, 관리자 UI |
| Backend | [../backend/src/server.ts](../backend/src/server.ts) | API, Socket.IO, 반응 계획 실행 |
| Database package | [../database/src/migrate.ts](../database/src/migrate.ts) | DB migration 실행 |
| Local LLM server | [../local-llm/server.py](../local-llm/server.py) | GGUF 모델로 메시지/요약/침묵 의미 생성 |
| Shared types | [../shared/src/index.ts](../shared/src/index.ts) | 프론트와 백엔드가 공유하는 타입 |
| Scheduler | [../scheduler/src/index.ts](../scheduler/src/index.ts) | 선제 발화 가능 여부 판단 |

## 의존성 확인

루트 [../package.json](../package.json)은 npm workspace를 사용합니다. `frontend`, `backend`, `shared`, `database`, `scheduler`가 한 repo 안에서 연결됩니다.

중요한 스크립트:

- `npm run build`: 공유 패키지부터 전체 빌드
- `npm run dev`: 백엔드와 프론트 개발 서버 동시 실행
- `npm run migrate`: DB migration 실행
- `npm run test -w backend`: 백엔드 테스트
- `npm run llm:server:windows`: Windows용 로컬 LLM 서버 실행

Python 의존성은 [../local-llm/requirements.txt](../local-llm/requirements.txt)에 있습니다. 모델 파일은 의존성이 아니라 외부 실행 자원입니다.

## 환경 변수

기본 예시는 [../.env.example](../.env.example)에 있습니다. 실제 실행은 repo 루트의 `.env`를 읽습니다.

주요 값:

- `HF_MODEL_PATH`: 로컬 GGUF 모델 파일 경로
- `HF_LOCAL_URL`: 백엔드가 LLM 서버에 요청할 주소
- `SQLITE_PATH`: SQLite DB 파일 경로
- `PROACTIVE_MIN_SILENCE_MS`: 선제 발화 최소 침묵 시간
- `PROACTIVE_COOLDOWN_MS`: 선제 발화 cooldown 시간
- `USER_CONTINUATION_GRACE_MS`: 사용자가 더 말할지 기다리는 초기 유예 시간

[../backend/src/config.ts](../backend/src/config.ts)는 환경 변수를 읽고 숫자 값이 잘못되면 fallback을 사용합니다.

## 모델 파일 규칙

[../local-llm/server.py](../local-llm/server.py)는 `HF_MODEL_PATH`가 비어 있거나, 파일이 없거나, `.gguf`가 아니면 시작하지 않습니다.

이 선택은 중요합니다.

- 실행 중 몰래 다운로드하지 않습니다.
- 네트워크가 없어도 "모델이 준비되어 있는지"를 명확히 알 수 있습니다.
- safetensors와 GGUF의 차이를 숨기지 않습니다.
- 실패 원인을 모델 경로 문제와 코드 문제로 분리할 수 있습니다.

## 실행 흐름 확인 명령

실제로 실행할 때는 [../README.md](../README.md)의 운영체제별 안내를 따릅니다. 학습 중에는 먼저 빌드와 테스트처럼 모델이 없어도 가능한 검증을 해보는 편이 좋습니다.

```bash
npm run build
npm run test -w backend
```

로컬 LLM까지 확인하려면 모델 파일과 Python 환경이 준비된 뒤 다음 health check를 사용합니다.

```bash
curl http://127.0.0.1:8010/health
curl http://127.0.0.1:4000/api/health
```

## 실습

1. [../package.json](../package.json)에서 `predev` 스크립트가 어떤 순서로 실행되는지 적습니다.
2. [../backend/src/config.ts](../backend/src/config.ts)에서 `proactiveMinSilenceMs`의 기본값을 찾습니다.
3. [../local-llm/server.py](../local-llm/server.py)에서 모델 파일 검증 함수 이름을 찾습니다.
4. 모델 파일이 없을 때 생기는 실패는 "환경 문제"인지 "코드 문제"인지 분류해 봅니다.

## 이해 확인 퀴즈

1. 기본: `HF_MODEL_PATH`가 필요한 이유를 설명하세요.
2. 적용: 백엔드는 켜졌지만 AI 응답이 오지 않습니다. LLM 서버와 백엔드 중 어디를 먼저 확인할지 순서를 쓰세요.
3. 변형: `PROACTIVE_MIN_SILENCE_MS`를 너무 작게 줄이면 사용자 경험에 어떤 영향이 있을까요?
4. 독립 수행: 새 개발자가 실행 환경을 점검할 수 있도록 5단계 체크리스트를 작성하세요.

해설: [solutions/02-prerequisites.md](solutions/02-prerequisites.md)

## 핵심 요약

삼마고 실행 실패는 의존성, 환경 변수, 모델 파일, 코드 문제로 나누어 봐야 합니다. 특히 로컬 LLM은 자동 다운로드하지 않으므로 모델 경로 검증이 첫 번째 관문입니다.

다음 문서: [03-project-map.md](03-project-map.md)
