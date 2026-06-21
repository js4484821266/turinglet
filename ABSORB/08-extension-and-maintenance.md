# 08. 확장과 유지보수

## 이번 문서의 학습 목표

이 문서는 삼마고를 확장하거나 수정할 때 지켜야 할 기준을 설명한다. 목표는 기능을 추가하더라도 "부담 낮은 말동무"라는 초기 방향과 현재 코드의 계약을 깨지 않는 것이다.

## 앞 문서와의 연결

[07-testing-and-debugging.md](07-testing-and-debugging.md)에서 검증 방법을 배웠다. 이제 앞으로 코드를 바꿀 때 어떤 경계를 지켜야 하는지 본다.

## 유지보수의 핵심 기준

| 기준 | 의미 |
| --- | --- |
| 말할 내용과 시점 분리 | route에서 바로 assistant 답변을 만들지 않는다. |
| typing 존중 | 사용자가 입력 중이면 응답을 미루는 정책을 유지한다. |
| 낮은 압력 | proactive 메시지는 반복 재촉이 되지 않게 cooldown을 유지한다. |
| 타입 계약 유지 | `shared` 타입 변경 시 모든 소비자를 함께 확인한다. |
| LLM output 검증 | 모델 응답을 그대로 DB 상태로 쓰지 않는다. |
| 명시적 모델 파일 | 실행 중 자동 다운로드로 바꾸지 않는다. |

## 기능별 확장 지점

### 대화 정책 개선

먼저 [backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)와 [scheduler/src/index.ts](../scheduler/src/index.ts)를 본다. continuation 판단, 고감정 침묵 정책, cooldown 정책을 수정할 수 있다.

수정 시 [backend/tests/policy.test.ts](../backend/tests/policy.test.ts)에 정책 예시를 추가하는 것이 좋다.

### provider 교체

현재 provider는 [backend/src/adapters/hfLocalProvider.ts](../backend/src/adapters/hfLocalProvider.ts)다. 다른 LLM provider를 추가하려면 [shared/src/index.ts](../shared/src/index.ts)의 `LLMProviderAdapter` 계약을 그대로 구현해야 한다.

새 provider를 만들더라도 [hfLocalValidation.ts](../backend/src/adapters/hfLocalValidation.ts) 같은 검증 계층을 유지해야 한다.

### DB 저장소 확장

저장소 계약은 [backend/src/db/types.ts](../backend/src/db/types.ts)의 `Store`다. SQLite와 PostgreSQL 구현은 같은 interface를 따른다.

새 query가 필요하면 먼저 `Store`에 필요한 메서드를 명시하고, SQLite와 PostgreSQL 구현을 함께 맞춘다. migration도 [database/migrations](../database/migrations/)에 추가해야 한다.

### 관리자 화면 확장

관리자 API는 [backend/src/routes/adminRoutes.ts](../backend/src/routes/adminRoutes.ts), 화면은 [frontend/src/components/AdminPanel.tsx](../frontend/src/components/AdminPanel.tsx)에 있다. 관리자 token은 현재 메모리 저장이므로 재시작 후 유지되어야 하는 기능을 추가하려면 token 저장 방식을 먼저 설계해야 한다.

### safety 기능 확장

[database/migrations/001_init.sql](../database/migrations/001_init.sql)에는 `safety_flags` 테이블이 있고, [prompt-engineering/safety-sensitive-response-prompt.md](../prompt-engineering/safety-sensitive-response-prompt.md)에는 안전 민감 응답 원칙이 있다. 실제 감지와 대응 flow를 추가할 때는 "상담/의료/응급 서비스를 대체하지 않는다"는 README의 한계를 유지해야 한다.

## prompt 문서와 runtime prompt

[prompt-engineering](../prompt-engineering/) 문서는 설계 자료다. 현재 실행 prompt는 [local-llm/server.py](../local-llm/server.py) 안에 직접 들어 있다.

프롬프트를 바꿀 때는 두 위치의 관계를 분명히 해야 한다.

- 설계 원칙을 바꾸는 경우: `prompt-engineering` 문서와 `.prompts.md` 기록 여부를 검토한다.
- 실제 실행 문구를 바꾸는 경우: `local-llm/server.py`를 수정하고 LLM response validation을 함께 확인한다.

## ABSORB 문서 갱신 기준

다음 변경이 있으면 `ABSORB/` 문서도 함께 갱신한다.

- 사용자 흐름이 바뀜
- route, runtime, engine 책임 경계가 바뀜
- DB schema나 주요 테이블 의미가 바뀜
- 실행 명령이나 환경 변수 의미가 바뀜
- provider 계약이나 LLM task가 바뀜
- 테스트 전략이나 알려진 오류 대응이 바뀜

단순 오타 수정이나 작은 UI 문구 변경처럼 교재와 직접 불일치가 생기지 않는 변경은 갱신하지 않아도 된다.

## 피해야 할 변경 방향

- 사용자 메시지 POST에서 assistant 답변을 동기 반환하도록 바꾸기
- typing 상태를 무시하고 message queue에서 바로 보내기
- proactive cooldown을 제거하거나 반복 check-in을 쉽게 만들기
- LLM output 검증을 제거하기
- `.env`나 모델 파일을 repo에 커밋하기
- SQLite DB, 관리자 BMP, local model 같은 실행 산출물을 원본 코드처럼 다루기
- `shared` 타입을 바꾸고 frontend/backend/scheduler 중 일부만 수정하기

## 개선 과제

| 난이도 | 과제 | 관련 파일 |
| --- | --- | --- |
| Easy | prompt 문서와 runtime prompt의 차이를 명시 | [prompt-engineering](../prompt-engineering/), [local-llm/server.py](../local-llm/server.py) |
| Medium | proactive event에 실제 sent/skip 결과 기록 | [messageQueue.ts](../backend/src/runtime/messageQueue.ts), [proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts) |
| Medium | PostgreSQL migration 절차 추가 | [database/src/migrate.ts](../database/src/migrate.ts), [database/migrations](../database/migrations/) |
| Medium | 관리자 token 영속화 또는 공유 저장소 도입 | [adminRoutes.ts](../backend/src/routes/adminRoutes.ts) |
| Hard | 대화 타이밍 정량 평가 지표 추가 | [scheduler/src/index.ts](../scheduler/src/index.ts), [policy.test.ts](../backend/tests/policy.test.ts) |
| Hard | safety-sensitive 감지와 대응 flow 구현 | [safety-sensitive-response-prompt.md](../prompt-engineering/safety-sensitive-response-prompt.md), [database/migrations/001_init.sql](../database/migrations/001_init.sql) |

## 자주 헷갈리는 부분

"더 똑똑한 LLM"을 붙이는 것만으로 이 프로젝트의 핵심이 개선되지는 않는다. 삼마고의 핵심은 LLM 품질뿐 아니라 언제 기다리고, 언제 짧게 말하고, 언제 말하지 않을지를 결정하는 정책이다.

또한 관리자 대시보드는 운영자용 완성 제품이라기보다 로컬 실험 관찰 표면에 가깝다. production 수준으로 확장하려면 인증, token 저장, 감사 로그, 접근 제어를 별도로 강화해야 한다.

## 반드시 이해해야 할 요점

- 확장보다 먼저 현재 책임 경계를 유지해야 한다.
- prompt 설계 문서와 runtime prompt drift를 관리해야 한다.
- DB schema 변경은 store interface, migration, 테스트, ABSORB 문서까지 연결된다.
- 사용자에게 부담을 낮추는 방향이 기능 추가보다 우선이다.

## 다음 문서

다음은 [09-interview-and-portfolio.md](09-interview-and-portfolio.md)에서 이 프로젝트를 외부에 설명하는 방법을 배운다.

