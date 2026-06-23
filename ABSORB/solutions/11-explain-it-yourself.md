# 11 해설: 자기 말로 설명하기

## 1. 기본

삼마고는 상담, 의료, 응급 서비스를 대체하지 않는 말동무형 프로토타입이다. 감정적으로 안전한 표현을 지향하지만, 진단이나 전문 상담 기능을 제공한다고 말하면 프로젝트 의도와 안전 기준을 과장하는 것이다.

근거 문서: [../../README.md](../../README.md), [../../prompt-engineering/system-prompt.md](../../prompt-engineering/system-prompt.md)

## 2. 적용

답장이 늦게 오는 이유는 성능 문제일 수도 있지만, 구조적으로는 reactive planner가 사용자가 더 말할 가능성과 typing 상태를 기다리기 때문이다. HTTP 요청은 `202`로 끝나고, assistant 메시지는 나중에 queue와 Socket.IO를 통해 도착한다.

근거 코드: [../../backend/src/routes/chatRoutes.ts](../../backend/src/routes/chatRoutes.ts), [../../backend/src/runtime/reactivePlanner.ts](../../backend/src/runtime/reactivePlanner.ts), [../../backend/src/runtime/messageQueue.ts](../../backend/src/runtime/messageQueue.ts)

## 3. 변형

로컬 LLM 없이도 설명 가능한 부분:

- 코드 구조
- 타입과 route 흐름
- scheduler 정책
- DB schema

설명하면 안 되는 실행 결과:

- 실제 모델 응답 품질
- `/v1/generate`의 정상 생성 결과
- 모델 로딩 성능

## 4. 독립 수행

좋은 발표 스크립트 기준:

- 프로젝트 목적을 한 문장으로 말한다.
- reactive/proactive 차이를 예시로 든다.
- 최소 5개 이상의 파일 근거를 붙인다.
- 한계를 말한다.
- AI 도움을 받은 경우, 어떤 도움을 받았고 본인이 어떤 구조를 이해했는지 구분한다.
