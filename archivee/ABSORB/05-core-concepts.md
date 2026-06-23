# 05. 핵심 개념

## 이번 문서의 학습 목표

- presence, snapshot, plan, queue, provider의 뜻을 프로젝트 코드 기준으로 정의한다.
- 핵심 타입이 어떤 파일과 런타임 동작으로 이어지는지 이해한다.
- 처음 보는 용어를 코드 링크와 함께 설명할 수 있게 된다.

## 앞 문서와의 연결

[04-execution-flow.md](04-execution-flow.md)에서 전체 흐름을 봤다. 이제 흐름을 구성하는 핵심 개념을 하나씩 정의한다.

## 먼저 생각해 볼 질문

AI가 "지금 답하지 않기"를 선택할 때도 그것은 하나의 계획일까?

## 공유 타입

[shared/src/index.ts](../shared/src/index.ts)는 패키지 간 계약이다. 여기서 정의된 타입은 backend, frontend, scheduler가 같은 의미로 사용해야 한다.

| 타입 | 의미 | 쓰이는 곳 |
| --- | --- | --- |
| `PresenceState` | assistant가 보이는 상태: `typing`, `thinking`, `organizing`, `waiting` | [realtime.ts](../backend/src/runtime/realtime.ts), [ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx) |
| `SessionMachineState` | 대화 세션의 내부 상태 | [orchestrator.ts](../backend/src/engine/orchestrator.ts), [scheduler/src/index.ts](../scheduler/src/index.ts) |
| `ConversationSnapshot` | 판단에 필요한 현재 대화 요약 | store 구현, scheduler, orchestrator |
| `MultiMessagePlan` | 몇 개의 메시지를 어떤 delay로 보낼지 담는 계획 | provider, orchestrator, queue |
| `LLMProviderAdapter` | backend가 LLM 서버를 호출할 때 기대하는 interface | [hfLocalProvider.ts](../backend/src/adapters/hfLocalProvider.ts) |
| `ProactiveDecision` | 선제 발화 가능 여부 판단 결과 | [scheduler/src/index.ts](../scheduler/src/index.ts) |

## Presence

presence는 UI 장식만이 아니다. 사용자가 입력 중인지와 assistant가 생각 중인지가 발송 정책에 영향을 준다.

- 프론트 입력 변화: [ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx)의 `onDraftChange`
- typing API: [chatRoutes.ts](../backend/src/routes/chatRoutes.ts)의 `/api/chat/typing`
- 저장/조회: store의 `setTypingPresence`, `isUserTyping`
- 발송 직전 확인: [messageQueue.ts](../backend/src/runtime/messageQueue.ts)

## Snapshot

`ConversationSnapshot`은 전체 대화 기록을 매번 모두 넘기는 대신, 판단에 필요한 요약 상태를 모은 구조다.

```ts
export interface ConversationSnapshot {
  sessionId: string;
  lastUserMessageAt?: number;
  lastAssistantMessageAt?: number;
  lastMessageAt?: number;
  recentEmotionalIntensity: number;
  userTyping: boolean;
  state: SessionMachineState;
}
```

이 값은 reactive 응답과 proactive 발화 모두에서 사용된다. 그래서 snapshot을 잘못 만들면 두 흐름이 함께 흔들린다.

## Plan

`MultiMessagePlan`은 "보낼 문장"만 담지 않는다. `sendCount`, `reason`, `nextState`, `messages`를 함께 담는다. `messages` 안에는 `delayMs`와 `presenceBeforeSend`가 있다.

`sendCount: 0`은 "아무것도 하지 않는다"가 아니라 "지금은 보내지 않는다"는 명시적 결정이다.

## Queue

[messageQueue.ts](../backend/src/runtime/messageQueue.ts)는 plan에 들어 있는 메시지를 timer로 예약하고, 발송 직전에 typing을 다시 확인한다. 이 재확인이 없으면 사용자가 다시 입력을 시작한 직후 assistant 후속 메시지가 끼어드는 문제가 생긴다.

## Provider

provider는 LLM 호출을 감싼 interface다. 현재 주요 구현은 [backend/src/adapters/hfLocalProvider.ts](../backend/src/adapters/hfLocalProvider.ts)이며, 로컬 FastAPI 서버 [local-llm/server.py](../local-llm/server.py)를 호출한다.

provider는 다음을 제공한다.

- 단일 메시지 생성
- 여러 메시지 plan 생성
- 최근 대화 감정 강도 요약
- 침묵 의미 추론

## 관찰 실습

1. [shared/src/index.ts](../shared/src/index.ts)의 `MultiMessagePlan`을 손으로 옮겨 적고 각 필드가 어디서 쓰이는지 파일명을 붙인다.
2. [orchestrator.ts](../backend/src/engine/orchestrator.ts)에서 provider를 호출하지 않고 직접 plan을 반환하는 경우를 찾는다.
3. [scheduler/src/index.ts](../scheduler/src/index.ts)의 `ProactiveDecisionInput`이 snapshot 외에 어떤 값을 더 받는지 확인한다.

## 자주 헷갈리는 부분

provider가 "AI 전체"가 아니다. 이 프로젝트에서 AI처럼 보이는 동작은 provider의 문장 생성, orchestrator의 운영 판단, planner와 queue의 타이밍 제어가 합쳐진 결과다.

## 이해 확인 질문

- `ConversationSnapshot`에 전체 메시지 목록이 없는 이유는 무엇인가?
- `MultiMessagePlan.messages`에 `delayMs`가 필요한 이유는 무엇인가?
- presence가 UI 상태이면서 동시에 정책 입력인 이유는 무엇인가?

## 핵심 요약

핵심 타입을 먼저 이해하면 파일이 많아도 흐름이 단순해진다. 삼마고는 snapshot을 보고 plan을 만들고, queue가 plan을 실행한다.

다음 문서: [06-code-walkthrough.md](06-code-walkthrough.md)
