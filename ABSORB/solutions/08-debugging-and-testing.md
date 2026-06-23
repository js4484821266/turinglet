# 08 해설: 디버깅과 테스트

## 1. 기본

Vitest 테스트는 TypeScript 정책 로직을 검증하지만, 로컬 GGUF 모델 파일의 존재나 Python 서버 실행을 보장하지 않는다. 모델 준비는 [../../local-llm/server.py](../../local-llm/server.py)의 startup 검증과 `/health`로 따로 확인해야 한다.

## 2. 적용

확인 순서 예시:

1. POST 응답 body와 status 202 확인
2. backend 로그에서 reactive planner/provider 오류 확인
3. typing 상태 때문에 대기 중인지 확인
4. messageQueue가 실행됐는지 확인
5. socket room join과 `message` 이벤트 수신 확인

## 3. 변형

proactive loop에서 한 세션 오류를 전체 실패로 처리하면, 한 사용자의 잘못된 데이터나 LLM 오류 때문에 다른 세션의 선제 발화까지 멈춘다. [../../backend/src/runtime/proactiveLoop.ts](../../backend/src/runtime/proactiveLoop.ts)는 session별 try/catch로 이를 막는다.

## 4. 독립 수행

테스트 전략 예시:

- grace 시간이 적용되어 첫 plan이 즉시 실행되지 않는지 fake timer로 확인
- typing 중이면 재예약되는지 확인
- max wait 이후 forced plan으로 넘어가는지 확인
- 기존 `policy.test.ts`에 continuation 예시를 추가
