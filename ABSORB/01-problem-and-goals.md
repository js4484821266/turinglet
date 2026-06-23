# 01. 문제와 설계 목표

## 학습 목표

- 삼마고가 일반적인 1문 1답 챗봇과 다른 문제를 다룬다는 점을 설명한다.
- "무엇을 말할지"와 "언제 말할지"가 코드에서 분리되는 이유를 이해한다.
- 최초 설계 의도가 현재 파일 구조에 어떻게 남아 있는지 찾는다.

## 앞 문서와의 연결

[README](README.md)에서 전체 학습 순서를 봤다면, 이제 프로젝트의 목적부터 잡습니다. 코드를 먼저 보면 Express, React, DB 같은 기술이 눈에 들어오지만, 이 프로젝트의 핵심은 기술 목록보다 대화 타이밍 정책입니다.

## 먼저 생각해 볼 질문

- 사용자가 메시지를 보냈을 때 AI가 항상 즉시 답하면 어떤 문제가 생길 수 있을까요?
- 사용자가 입력 중이라는 신호를 서버가 알고 있으면 어떤 결정을 다르게 할 수 있을까요?
- 긴 침묵은 항상 "사용자가 떠났다"는 뜻일까요?

## 핵심 문제

삼마고는 사용자가 정리되지 않은 말이나 기분을 부담 없이 남길 수 있는 AI 말동무 프로토타입입니다. 일반 챗봇처럼 "사용자 입력 1개 -> AI 답변 1개"로 고정하지 않습니다.

프로젝트가 다루는 핵심 질문은 다음 네 가지입니다.

- 지금 바로 답해야 하는가?
- 사용자가 더 말할 가능성이 있으니 기다려야 하는가?
- 침묵이 길어졌을 때 짧게 먼저 말을 걸어도 되는가?
- 답변을 한 문장으로 보낼지, 짧은 여러 메시지로 나눌지 어떻게 정할 것인가?

이 질문은 [../README.md](../README.md)의 프로젝트 소개와 [../prompt-engineering/system-prompt.md](../prompt-engineering/system-prompt.md)의 프롬프트 규칙에 직접 연결됩니다.

## 설계 목표

| 목표 | 코드에서 드러나는 위치 | 의미 |
| --- | --- | --- |
| 즉시 응답 고정 피하기 | [../backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts) | HTTP 요청은 먼저 `202`로 받고, 실제 응답 계획은 잠깐 뒤 계산한다. |
| 사용자가 입력 중이면 끼어들지 않기 | [../backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts) | `snapshot.userTyping`이 true면 `sendCount: 0` 계획을 반환한다. |
| 침묵을 단순 이탈로 보지 않기 | [../backend/src/runtime/proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts) | 침묵 시간이 길고 cooldown이 끝난 세션만 선별한다. |
| 메시지 개수와 지연을 계획으로 다루기 | [../shared/src/index.ts](../shared/src/index.ts) | `MultiMessagePlan`과 `OutboundMessageInstruction` 타입이 따로 있다. |
| 로컬 LLM 실패를 명확히 드러내기 | [../local-llm/server.py](../local-llm/server.py) | 모델 파일이 없거나 GGUF가 아니면 서버 시작 단계에서 실패한다. |

## 현재 코드와 최초 의도의 관계

현재 구조는 "생성 모델이 모든 것을 결정한다"가 아니라, 규칙 기반 판단과 LLM 호출을 섞습니다.

```text
사용자 행동
  -> snapshot 생성
  -> 규칙으로 기다릴지 먼저 판단
  -> 필요할 때만 LLM에 메시지 계획 요청
  -> plan에 포함된 delayMs와 presence를 적용해 전송
```

이 구조는 말동무형 대화를 위해 중요합니다. 모델이 좋은 문장을 만들더라도, 사용자가 아직 쓰는 중이면 그 문장은 보내지 않아야 하기 때문입니다.

## 직접 관찰하기

1. [../backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)를 엽니다.
2. `planForUserMessage`에서 LLM을 호출하기 전에 어떤 조건을 먼저 검사하는지 확인합니다.
3. `likelyUserWillContinue`의 정규식들이 어떤 한국어 문장 끝을 감지하는지 읽어봅니다.

예상 관찰 결과:

- `userTyping`이 true면 LLM을 부르지 않고 기다립니다.
- 짧은 조각, 연결어, 열린 문장 끝은 더 말할 가능성으로 보고 기다립니다.
- 그 외에는 `provider.generateMultiMessagePlan`으로 넘깁니다.

## 자주 헷갈리는 부분

- 삼마고는 상담 서비스가 아닙니다. [../prompt-engineering/system-prompt.md](../prompt-engineering/system-prompt.md)도 상담사나 응급 서비스처럼 행동하지 말라고 제한합니다.
- 침묵 선제 발화는 무조건 실행되지 않습니다. [../scheduler/src/index.ts](../scheduler/src/index.ts)의 `evaluateProactiveDecision`이 최소 침묵 시간, cooldown, 입력 중 여부를 먼저 봅니다.
- `sendCount: 0`은 실패가 아닙니다. "지금은 보내지 않는 것이 맞다"는 정상 계획입니다.

## 실습

1. `orchestrator.ts`에서 `likelyUserWillContinue("근데")`가 true일지 예측합니다.
2. `likelyUserWillContinue("고마워")`가 false일지 예측합니다.
3. `snapshot.userTyping`이 true인 입력 객체를 상상하고, `planForUserMessage`의 반환 구조를 손으로 써봅니다.
4. 원본을 보지 않고 "사용자가 더 말할 것 같은 문장 끝" 예시를 5개 적습니다.

## 이해 확인 퀴즈

1. 기본: 삼마고가 일반 챗봇의 1문 1답 구조를 그대로 따르지 않는 이유를 설명하세요.
2. 적용: `sendCount: 0`이 정상 결과인 상황을 코드 위치와 함께 설명하세요.
3. 변형: 사용자가 "그리고..."라고 보낸 뒤 바로 멈췄습니다. 어떤 파일의 어떤 함수가 기다림을 선택할 가능성이 높나요?
4. 독립 수행: "말할 내용"과 "보낼 시점"을 분리하는 작은 타입을 직접 설계해 보세요.

해설: [solutions/01-problem-and-goals.md](solutions/01-problem-and-goals.md)

## 핵심 요약

삼마고의 중심은 좋은 답변 문장 하나가 아니라, 사용자가 말하는 흐름을 방해하지 않는 반응 정책입니다. 이 관점이 이후 문서의 모든 코드 읽기 기준입니다.

다음 문서: [02-prerequisites.md](02-prerequisites.md)
