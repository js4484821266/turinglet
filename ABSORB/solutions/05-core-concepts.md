# 05 해설: 핵심 개념

## 1. 기본

presence는 "생각 중", "정리 중" 같은 상태 신호이고, message는 DB에 저장되는 실제 대화 내용이다. presence는 화면의 진행감을 만들지만 대화 기록 그 자체는 아니다.

근거 코드: [../../shared/src/index.ts](../../shared/src/index.ts), [../../backend/src/runtime/realtime.ts](../../backend/src/runtime/realtime.ts)

## 2. 적용

감정 강도가 8이고 침묵이 길면 [../../backend/src/engine/orchestrator.ts](../../backend/src/engine/orchestrator.ts)의 `planForSilence`가 고강도 감정 침묵으로 보고 공감 후 기다리는 메시지를 만들 수 있다.

## 3. 변형

LLM은 형식이 흔들릴 수 있으므로 `messages: []` 같은 계획을 그대로 실행하면 사용자는 아무 것도 받지 못하거나 queue가 의미 없는 작업을 하게 된다. [../../backend/src/adapters/hfLocalValidation.ts](../../backend/src/adapters/hfLocalValidation.ts) 같은 검증이 필요하다.

## 4. 독립 수행

매번 최근 메시지 200개를 읽으면 DB 비용과 LLM payload가 커지고, 판단에 필요한 현재 상태를 빠르게 얻기 어렵다. snapshot은 판단에 필요한 값을 압축해 전달한다.
