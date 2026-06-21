# 07. 테스트와 디버깅

## 이번 문서의 학습 목표

이 문서는 현재 프로젝트를 어떻게 검증하고, 오류가 났을 때 어디부터 확인해야 하는지 설명한다. 목표는 환경 문제, 경로 문제, 모델 문제, 코드 문제를 섞어 판단하지 않는 것이다.

## 앞 문서와의 연결

[06-implementation-details.md](06-implementation-details.md)에서 핵심 정책과 구현 방식을 배웠다. 이제 그 정책이 깨지지 않았는지 확인하는 방법을 본다.

## 기본 검증 명령

루트 기준으로 자주 쓰는 명령은 다음과 같다.

```bash
npm run build
npm test
```

DB migration은 다음 명령으로 확인한다.

```bash
npm run migrate
```

local LLM health check는 LLM 서버가 떠 있을 때 확인한다.

```bash
curl http://127.0.0.1:8010/health
```

백엔드 health check는 다음과 같다.

```bash
curl http://127.0.0.1:4000/api/health
```

Windows PowerShell에서는 `curl.exe`를 명시하면 PowerShell alias 혼동을 줄일 수 있다.

## 현재 테스트 파일

| 파일 | 검증 대상 |
| --- | --- |
| [backend/tests/policy.test.ts](../backend/tests/policy.test.ts) | proactive decision, typing 중 개입 방지, 고감정 침묵 정책, per-session failure isolation |
| [backend/tests/auth-qr.test.ts](../backend/tests/auth-qr.test.ts) | QR 가입, QR 로그인 성공, 변조 payload 실패 |
| [backend/tests/admin-auth.test.ts](../backend/tests/admin-auth.test.ts) | 관리자 BMP 생성, 로그인, 다른 BMP 거부, bearer token 보호 |

테스트는 [backend/package.json](../backend/package.json)의 `vitest run`으로 실행된다.

## 수동 검증 시나리오

### 1. QR 가입과 로그인

1. `npm run migrate`를 실행한다.
2. `npm run dev:llm:windows` 또는 `npm run dev:llm:debian`을 실행한다.
3. `http://localhost:5173`에 접속한다.
4. QR 가입을 누른다.
5. QR payload로 로그인한다.
6. 최초 세션이면 greeting 메시지가 보이는지 확인한다.

관련 파일은 [AuthPanel.tsx](../frontend/src/components/AuthPanel.tsx)와 [authRoutes.ts](../backend/src/routes/authRoutes.ts)다.

### 2. reactive 채팅

1. 채팅 입력창에 메시지를 쓴다.
2. Enter 또는 보내기 버튼으로 전송한다.
3. user 메시지가 즉시 보이는지 확인한다.
4. assistant presence가 `thinking`, `organizing`, `typing` 중 하나로 바뀌는지 확인한다.
5. assistant 메시지가 socket으로 나중에 도착하는지 확인한다.

관련 파일은 [ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx), [chatRoutes.ts](../backend/src/routes/chatRoutes.ts), [reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts), [messageQueue.ts](../backend/src/runtime/messageQueue.ts)다.

### 3. typing 중 개입 방지

1. 입력창에 긴 문장을 쓰기 시작한다.
2. 타이핑을 멈추지 않고 이어간다.
3. assistant 메시지가 즉시 끼어들지 않는지 확인한다.
4. 타이핑을 멈춘 뒤 일정 시간이 지나면 응답이 오는지 확인한다.

### 4. proactive 선제 발화

개발 중에는 `.env`에서 `PROACTIVE_MIN_SILENCE_MS`와 `PROACTIVE_COOLDOWN_MS`를 낮춰 테스트할 수 있다. 단, 실제 `.env` 값은 개인 환경 설정이므로 커밋하지 않는다.

1. 사용자가 메시지를 남긴다.
2. 설정한 silence window 동안 아무 입력도 하지 않는다.
3. 선제 메시지가 한 번만 낮은 압력으로 오는지 확인한다.
4. 관리자 화면에서 `proactive_events`가 기록됐는지 확인한다.

### 5. 관리자 대시보드

1. 백엔드 실행 시 생성된 `runtime/achrai-admin-key.bmp`를 찾는다.
2. `http://localhost:5173/achrai/`에 접속한다.
3. 해당 BMP를 업로드한다.
4. 사용자, 세션, 메시지, proactive event가 보이는지 확인한다.

## 자주 나는 오류와 확인 순서

| 증상 | 먼저 확인할 것 |
| --- | --- |
| 백엔드가 시작되지 않음 | local LLM `/health`, `HF_LOCAL_URL`, `HF_LOCAL_STARTUP_WAIT_MS` |
| LLM 서버가 시작되지 않음 | `HF_MODEL_PATH`, 파일 존재, `.gguf` 확장자, 파일 크기 |
| `Requested tokens exceed context window` | `HF_CONTEXT_SIZE`, 최근 메시지 payload 크기 |
| QR 로그인 실패 | QR payload 변조 여부, DB token 존재, migration 적용 |
| assistant 메시지가 안 옴 | typing 상태가 계속 true인지, local LLM 오류, backend console error |
| proactive가 너무 자주 옴 | `PROACTIVE_COOLDOWN_MS`, `proactive_events` 기록 |
| 관리자 로그인 실패 | 이번 실행에서 생성된 BMP인지, 이전 실행 키를 쓰고 있지 않은지 |
| 스마트폰 접속 실패 | PC와 같은 Wi-Fi, Vite host, Windows 방화벽 5173/4000 |

## 테스트를 해석할 때 주의할 점

Vitest가 실패했다고 모두 코드 오류는 아니다. Windows 환경에서는 native dependency, process spawn, 권한 문제로 실패할 수 있다. 이 경우 오류 원문을 보존하고, 의존성 설치 문제인지, DB 파일 경로 문제인지, 테스트 코드 문제인지 분리해서 본다.

LLM 관련 오류도 마찬가지다. 모델 파일이 없어서 실패한 것과 provider 응답 검증이 실패한 것은 다른 문제다. 전자는 환경 문제이고, 후자는 모델 output 또는 validation 계약 문제다.

## 디버깅 기준 파일

| 문제 영역 | 먼저 볼 파일 |
| --- | --- |
| 실행 시작 실패 | [backend/src/server.ts](../backend/src/server.ts), [backend/src/runtime/llmHealth.ts](../backend/src/runtime/llmHealth.ts) |
| 환경 변수 | [backend/src/config.ts](../backend/src/config.ts), [.env.example](../.env.example) |
| DB 경로 | [database/src/env.ts](../database/src/env.ts), [backend/src/db/sqliteStore.ts](../backend/src/db/sqliteStore.ts) |
| 사용자 메시지 | [backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts) |
| assistant 지연 | [backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts) |
| 선제 발화 | [scheduler/src/index.ts](../scheduler/src/index.ts), [backend/src/runtime/proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts) |
| LLM 응답 | [backend/src/adapters/hfLocalProvider.ts](../backend/src/adapters/hfLocalProvider.ts), [local-llm/server.py](../local-llm/server.py) |
| 관리자 인증 | [backend/src/routes/adminRoutes.ts](../backend/src/routes/adminRoutes.ts), [backend/src/utils/adminBitmap.ts](../backend/src/utils/adminBitmap.ts) |

## 반드시 이해해야 할 요점

- 테스트 실패는 환경, 경로, 의존성, 입력, 코드 문제를 나눠서 본다.
- LLM 서버와 백엔드는 별도 프로세스이며 각각 health check가 필요하다.
- 문서만 수정한 경우에도 링크와 파일 존재 여부를 확인하는 검증이 필요하다.
- 수동 검증은 "샘플에서 성공"이지 "모든 데이터에서 성공"으로 단정하면 안 된다.

## 다음 문서

다음은 [08-extension-and-maintenance.md](08-extension-and-maintenance.md)에서 확장과 유지보수 기준을 배운다.

