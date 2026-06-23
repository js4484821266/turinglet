# 05. 핵심 개념

## 학습 목표

- `ConversationSnapshot`, `PresenceState`, `MultiMessagePlan`의 역할을 설명한다.
- reactive와 proactive를 구분한다.
- 규칙 기반 판단과 LLM 판단이 어떻게 섞이는지 이해한다.

## 앞 문서와의 연결

[04-execution-flow.md](04-execution-flow.md)에서 흐름을 봤습니다. 이번 문서에서는 그 흐름을 구성하는 데이터 개념을 자세히 봅니다.

## 먼저 생각해 볼 질문

- 대화 상태를 매번 DB 전체 메시지로 판단하면 어떤 문제가 있을까요?
- assistant가 "생각 중"이라는 presence와 실제 메시지는 같은 데이터일까요?
- LLM이 항상 JSON을 잘 반환하지 않는다면 백엔드는 어떻게 방어해야 할까요?

## 공통 타입

핵심 타입은 [../shared/src/index.ts](../shared/src/index.ts)에 있습니다. 이 파일은 여러 패키지에서 같은 의미의 값을 쓰도록 기준을 제공합니다.

### ConversationSnapshot

`ConversationSnapshot`은 지금 세션의 요약 상태입니다.

- `sessionId`: 어떤 대화인지 구분
- `lastUserMessageAt`: 사용자가 마지막으로 말한 시각
- `lastAssistantMessageAt`: assistant가 마지막으로 말한 시각
- `recentEmotionalIntensity`: 최근 감정 강도
- `userTyping`: 사용자가 입력 중인지
- `state`: 상태 머신 이름

이 snapshot은 선제 발화 조건, 사용자 메시지 반응 판단, 침묵 의미 판단의 입력으로 쓰입니다.

### PresenceState

`PresenceState`는 assistant의 표시 상태입니다.

- `typing`
- `thinking`
- `organizing`
- `waiting`

Presence는 메시지가 아닙니다. 화면에서 "상대가 내용을 생각 중입니다..." 같은 상태를 보여주기 위한 실시간 신호입니다.

### MultiMessagePlan

`MultiMessagePlan`은 assistant가 보낼 메시지 계획입니다.

- `sendCount`: 보낼 메시지 개수
- `reason`: 왜 그렇게 판단했는지
- `nextState`: 다음 세션 상태
- `messages`: 실제 메시지 목록

각 메시지에는 `content`, `delayMs`, `presenceBeforeSend`가 있습니다. 그래서 "무엇을 말할지"와 "언제 보낼지"가 한 계획 안에 함께 들어갑니다.

## Reactive와 Proactive

| 구분 | 시작 조건 | 주요 파일 | 예 |
| --- | --- | --- | --- |
| Reactive | 사용자가 메시지를 보냄 | [../backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts) | "오늘 힘들었어"에 대한 반응 |
| Proactive | 침묵 시간이 길어짐 | [../backend/src/runtime/proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts) | "바로 답하지 않아도 괜찮아요" |

Reactive는 사용자의 직접 입력에 대한 반응이고, proactive는 침묵을 관찰하다가 조심스럽게 먼저 말 거는 흐름입니다.

## 규칙과 LLM의 분담

[../backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)는 먼저 규칙을 확인합니다.

- 사용자가 입력 중이면 보내지 않음
- 사용자가 더 말할 것 같은 짧은 조각이면 보내지 않음
- 감정 강도가 높고 침묵이 길면 정해진 공감 메시지를 보냄
- 그 외에는 provider를 통해 LLM 계획을 요청

LLM은 중요한 역할을 하지만, 모든 제어권을 갖지는 않습니다. 사용자 흐름을 방해하지 않는 최소 규칙은 코드가 직접 지킵니다.

## Provider Adapter

[../backend/src/adapters/hfLocalProvider.ts](../backend/src/adapters/hfLocalProvider.ts)는 백엔드와 Python LLM 서버 사이의 번역기입니다.

백엔드는 다음 작업을 provider 인터페이스로 요청합니다.

- `generateMessage`
- `generateMultiMessagePlan`
- `summarizeConversationState`
- `detectUserSilenceMeaning`

Python 서버 응답이 잘못되면 [../backend/src/adapters/hfLocalValidation.ts](../backend/src/adapters/hfLocalValidation.ts)가 계획 형식을 검증합니다.

## 상태 머신 이름

`SessionMachineState`는 실제 복잡한 상태 머신 라이브러리를 쓰는 것은 아니지만, 현재 대화 상태를 사람이 읽을 수 있게 이름 붙인 값입니다.

예:

- `idle`
- `user_typing`
- `reflective_pause`
- `proactive_checkin_candidate`
- `cooldown_after_outreach`
- `high_emotional_load`

이 이름들은 디버깅과 정책 설명에 유용합니다.

## 실습

1. `shared/src/index.ts`에서 `MultiMessagePlan`을 손으로 베껴 쓰지 말고, 각 필드가 왜 필요한지 한 줄씩 설명합니다.
2. `orchestrator.ts`에서 LLM을 호출하지 않는 분기를 모두 찾습니다.
3. `scheduler/src/index.ts`에서 `shouldSend: false`를 반환하는 조건을 표로 정리합니다.
4. `hfLocalProvider.ts`에서 백엔드가 Python 서버에 보내는 URL을 찾습니다.

## 이해 확인 퀴즈

1. 기본: presence와 message의 차이를 설명하세요.
2. 적용: `recentEmotionalIntensity`가 8이고 침묵이 길면 어떤 종류의 proactive 메시지가 선택될 가능성이 있나요?
3. 변형: LLM이 `messages: []`인 계획을 반환하면 왜 검증이 필요할까요?
4. 독립 수행: `ConversationSnapshot` 없이 매번 최근 메시지 200개를 읽어 판단하는 설계의 단점을 설명하세요.

해설: [solutions/05-core-concepts.md](solutions/05-core-concepts.md)

## 핵심 요약

삼마고의 핵심 데이터는 snapshot, presence, plan입니다. 이 세 개념을 구분하면 코드의 흐름이 훨씬 읽기 쉬워집니다.

다음 문서: [06-code-walkthrough.md](06-code-walkthrough.md)
