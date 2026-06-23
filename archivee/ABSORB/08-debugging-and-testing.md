# 08. 디버깅과 테스트

## 이번 문서의 학습 목표

- 작은 단위부터 검증하는 순서를 익힌다.
- 테스트 실패를 환경 문제, 경로 문제, 버전 문제, 입력 파일 문제, 코드 문제로 나눠 본다.
- 확인하지 않은 결과를 성공으로 말하지 않는 습관을 세운다.

## 앞 문서와의 연결

[07-data-and-state-flow.md](07-data-and-state-flow.md)에서 데이터가 어떻게 저장되는지 봤다. 이제 문제가 생겼을 때 어디부터 확인할지 정한다.

## 먼저 생각해 볼 질문

채팅 전송 실패가 떴을 때 원인은 frontend 코드, backend route, DB, LLM 서버, rate limit 중 어디일 수 있을까?

## 기본 검증 명령

```powershell
npm run build
```

```powershell
npm test
```

```powershell
npm run migrate
```

```powershell
curl.exe http://127.0.0.1:8010/health
curl.exe http://127.0.0.1:4000/api/health
```

## 테스트 구성

| 테스트 | 파일 | 검증하는 것 |
| --- | --- | --- |
| 정책 테스트 | [backend/tests/policy.test.ts](../backend/tests/policy.test.ts) | continuation, typing, proactive decision 정책 |
| QR 인증 테스트 | [backend/tests/auth-qr.test.ts](../backend/tests/auth-qr.test.ts) | QR payload 발급과 변조 거부 |
| 관리자 인증 테스트 | [backend/tests/admin-auth.test.ts](../backend/tests/admin-auth.test.ts) | BMP key login과 보호 route |

## 디버깅 순서

1. 재현 조건을 적는다. 입력 메시지, URL, 실행 명령, `.env`에서 민감값을 제외한 관련 key를 구분한다.
2. backend health를 확인한다.
3. local LLM health를 확인한다.
4. 브라우저 개발자 도구에서 실패한 API status를 확인한다.
5. backend console의 원문 오류를 본다.
6. DB migration이 적용됐는지 확인한다.
7. 관련 단위 테스트만 먼저 실행한다.

## 흔한 오류와 확인 위치

| 증상 | 먼저 볼 곳 | 해석 |
| --- | --- | --- |
| `ECONNREFUSED 127.0.0.1:8010` | local LLM 서버 | LLM 서버가 꺼졌거나 시작 실패했다. |
| `Requested tokens exceed context window` | [local-llm/server.py](../local-llm/server.py), `.env`의 `HF_CONTEXT_SIZE` | 모델 입력이 context보다 크다. |
| `Invalid message` | [routes/schemas.ts](../backend/src/routes/schemas.ts) | request body가 schema와 맞지 않는다. |
| 429 | [backend/src/rateLimit.ts](../backend/src/rateLimit.ts) | 짧은 시간에 요청이 너무 많다. |
| assistant가 안 옴 | [reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts), [messageQueue.ts](../backend/src/runtime/messageQueue.ts) | typing 또는 continuation 판단으로 미뤄졌을 수 있다. |
| 관리자 로그인 실패 | [adminRoutes.ts](../backend/src/routes/adminRoutes.ts), `runtime/achrai-admin-key.bmp` | 현재 실행에서 생성된 BMP가 아닐 수 있다. |

## 수동 확인 시나리오

1. 앱을 실행한다.
2. QR 가입으로 session을 만든다.
3. 채팅에 `근데`처럼 이어 말할 가능성이 높은 문장을 보낸다.
4. assistant가 즉시 끼어들지 않는지 본다.
5. 긴 문장을 입력 중인 상태에서 assistant 메시지가 오지 않는지 본다.
6. 일반 문장을 보낸 뒤 지연 후 assistant 메시지가 Socket.IO로 오는지 본다.

## 관찰 실습

1. [backend/tests/policy.test.ts](../backend/tests/policy.test.ts)를 읽고, 테스트 이름만 보고 어떤 정책을 보호하는지 적는다.
2. [scheduler/src/index.ts](../scheduler/src/index.ts)의 조건 순서를 바꾸면 어떤 테스트가 깨질지 예측한다.
3. [ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx)의 429 오류 메시지를 찾아 사용자가 어떤 안내를 보게 되는지 확인한다.

## 자주 헷갈리는 부분

샘플 입력 하나에서 성공했다고 해서 전체 데이터에서 성공한다고 단정할 수 없다. 특히 LLM 출력은 모델 파일, context size, prompt, 최근 대화 길이에 따라 달라진다.

## 이해 확인 질문

- local LLM health가 실패하면 frontend UI부터 고치는 것이 왜 비효율적인가?
- `npm run build`와 `npm test`는 각각 어떤 종류의 문제를 잘 잡는가?
- assistant가 안 오는 상황이 항상 오류가 아닌 이유는 무엇인가?

## 핵심 요약

디버깅은 작은 검증부터 시작한다. 서버, LLM, DB, route, timer, UI를 분리해서 봐야 원인을 빠르게 좁힐 수 있다.

다음 문서: [09-guided-modifications.md](09-guided-modifications.md)
