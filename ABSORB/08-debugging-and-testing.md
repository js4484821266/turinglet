# 08. 디버깅과 테스트

## 학습 목표

- 문제를 환경, 모델, DB, API, socket, UI로 나누어 확인한다.
- 기존 테스트가 어떤 정책을 보호하는지 이해한다.
- 작은 변경 후 어떤 검증을 먼저 실행할지 판단한다.

## 앞 문서와의 연결

[07-data-and-state-flow.md](07-data-and-state-flow.md)에서 데이터 흐름을 봤습니다. 이제 흐름 중 어느 지점이 깨졌는지 좁혀 가는 방법을 배웁니다.

## 먼저 생각해 볼 질문

- 메시지 전송 버튼을 눌렀는데 화면에 답이 없을 때, "LLM이 멍청하다"라고 바로 판단해도 될까요?
- 테스트가 통과해도 모델 파일 없이 전체 앱이 동작한다고 말할 수 있을까요?
- 선제 발화가 안 오는 것은 버그일까요, 정책상 정상일까요?

## 검증 순서

작은 단위부터 확인합니다.

1. 파일과 환경 변수 확인
2. lint
3. TypeScript build
4. backend test
5. DB migration
6. LLM health
7. backend health
8. frontend 화면
9. 실제 메시지 송수신

기본 명령:

```bash
npm run lint
npm run build
npm run test -w backend
npm run migrate
```

lint는 출력이 비어 있는 상태를 기준으로 합니다. import resolver 같은 설정 오류와 실제 코드 오류를 구분하며, 경고를 비활성화해 통과시키는 방식은 사용하지 않습니다.

LLM 서버가 준비된 경우:

```bash
curl http://127.0.0.1:8010/health
curl http://127.0.0.1:4000/api/health
```

## 기존 테스트 읽기

파일: [../backend/tests/policy.test.ts](../backend/tests/policy.test.ts)

이 테스트는 다음 정책을 확인합니다.

- 침묵이 길고 cooldown이 지나면 선제 발화 대상이 된다.
- 사용자가 typing 중이면 끼어들지 않는다.
- 감정 강도가 높은 침묵에는 공감 후 기다림 정책을 쓴다.
- proactive loop에서 한 세션 실패가 다른 세션을 막지 않는다.
- silence inference에는 최근 메시지 5개만 넘긴다.

파일: [../backend/tests/auth-qr.test.ts](../backend/tests/auth-qr.test.ts), [../backend/tests/admin-auth.test.ts](../backend/tests/admin-auth.test.ts)

이 테스트들은 QR 인증, 관리자 인증 같은 진입 흐름을 보호합니다.

## 흔한 문제 분류

| 증상 | 먼저 볼 곳 | 가능한 원인 |
| --- | --- | --- |
| 앱 시작 전 실패 | [../backend/src/server.ts](../backend/src/server.ts), [../backend/src/runtime/llmHealth.ts](../backend/src/runtime/llmHealth.ts) | LLM 서버 미준비 |
| LLM 서버 시작 실패 | [../local-llm/server.py](../local-llm/server.py) | `HF_MODEL_PATH` 없음, GGUF 아님, Python 의존성 문제 |
| 메시지 POST 400 | [../backend/src/routes/schemas.ts](../backend/src/routes/schemas.ts) | payload 형식 오류 |
| 메시지 POST 401 | [../backend/src/routes/sessionAuth.ts](../backend/src/routes/sessionAuth.ts) | 세션 헤더 누락 또는 만료 |
| POST는 성공하지만 답이 늦음 | [../backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts) | typing 또는 continuation 대기 |
| 선제 발화가 없음 | [../scheduler/src/index.ts](../scheduler/src/index.ts) | 최소 침묵 시간 미달, cooldown, 입력 중 |
| 화면에 메시지가 안 뜸 | [../frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx), [../backend/src/runtime/realtime.ts](../backend/src/runtime/realtime.ts) | socket room join 실패, 이벤트 미수신 |

## 오류 메시지 다루기

오류를 볼 때는 원문을 보존합니다. 예를 들어 로컬 모델 문제라면 `model file does not exist`와 `model file must be a GGUF file`은 원인이 다릅니다.

추정과 확인을 분리합니다.

- 확인된 사실: `/api/chat/messages`가 202를 반환했다.
- 추정: LLM 생성이 느릴 수 있다.
- 다음 확인: socket `message` 이벤트가 왔는지, backend 로그에 provider 오류가 있는지 본다.

## 실습

1. [../backend/tests/policy.test.ts](../backend/tests/policy.test.ts)에서 `does not interject while user is typing` 테스트를 읽고, 보호하는 사용자 경험을 설명합니다.
2. `evaluateProactiveDecision`에 새 조건을 추가한다고 가정하고 필요한 테스트 케이스를 2개 적습니다.
3. 모델 파일이 없을 때와 payload 검증 실패 때의 확인 위치를 각각 적습니다.
4. "선제 발화가 안 온다"는 이슈를 받았을 때 정상 정책인지 버그인지 구분하는 질문 4개를 만듭니다.

## 이해 확인 퀴즈

1. 기본: 테스트가 통과해도 LLM 모델 파일 준비를 보장하지 못하는 이유를 설명하세요.
2. 적용: POST `/api/chat/messages`가 202인데 assistant 메시지가 오지 않을 때 확인 순서를 쓰세요.
3. 변형: proactive loop에서 한 세션 오류를 전체 실패로 처리하면 어떤 문제가 생기나요?
4. 독립 수행: `USER_CONTINUATION_GRACE_MS` 변경에 대한 테스트 전략을 제안하세요.

해설: [solutions/08-debugging-and-testing.md](solutions/08-debugging-and-testing.md)

## 핵심 요약

삼마고 디버깅은 한 번에 전체를 의심하지 않고, 환경, LLM, API, runtime, DB, socket, UI를 순서대로 좁히는 작업입니다.

다음 문서: [09-guided-modifications.md](09-guided-modifications.md)
