# 05 해설: 핵심 개념

## 1. 기본

presence는 "생각 중", "정리 중" 같은 상태 신호이고, message는 DB에 저장되는 실제 대화 내용이다. presence는 화면의 진행감을 만들지만 대화 기록 그 자체는 아니다.

근거 코드: [../../shared/src/index.ts](../../shared/src/index.ts), [../../backend/src/runtime/realtime.ts](../../backend/src/runtime/realtime.ts)

## 2. 적용

감정 강도가 8이고 침묵이 길면 [../../backend/src/engine/orchestrator.ts](../../backend/src/engine/orchestrator.ts)의 `planForSilence`가 고강도 감정 침묵으로 보고 공감 후 기다리는 메시지를 만들 수 있다.

## 3. 변형

최종 `sendCount`는 3이어야 한다. [../../backend/src/adapters/hfLocalValidation.ts](../../backend/src/adapters/hfLocalValidation.ts)는 모델이 주장한 숫자를 신뢰하지 않고, 빈 문자열과 잘못된 항목을 제거한 실제 `messages.length`를 사용한다. 이렇게 해야 queue가 실행할 항목 수와 계획 metadata가 일치한다.

## 4. 독립 수행

매번 최근 메시지 200개를 읽으면 DB 비용과 LLM payload가 커지고, 판단에 필요한 현재 상태를 빠르게 얻기 어렵다. snapshot은 판단에 필요한 값을 압축해 전달한다.
