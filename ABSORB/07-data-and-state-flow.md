# 07. 데이터와 상태 흐름

## 학습 목표

- DB 테이블과 런타임 상태가 어떤 값을 나누어 갖는지 설명한다.
- 세션, 메시지, typing presence, emotional snapshot의 관계를 이해한다.
- 프론트 Zustand 상태와 서버 DB 상태를 구분한다.

## 앞 문서와의 연결

[06-code-walkthrough.md](06-code-walkthrough.md)에서 주요 파일을 읽었습니다. 이번에는 그 파일들이 다루는 데이터가 어디에 저장되고 어떻게 이동하는지 봅니다.

## 먼저 생각해 볼 질문

- 모든 UI 상태를 DB에 저장해야 할까요?
- typing 상태는 오래 보관해야 하는 데이터일까요?
- assistant 메시지가 화면에 보이려면 DB 저장과 socket 전송 중 어느 것이 필요할까요?

## DB 스키마 개요

DB 구조는 [../database/migrations/001_init.sql](../database/migrations/001_init.sql)에 있습니다.

| 테이블 | 역할 |
| --- | --- |
| `users` | 사용자 기본 정보 |
| `identity_tokens` | QR 로그인 토큰의 hash |
| `sessions` | 대화 세션 |
| `messages` | 사용자와 assistant 메시지 |
| `proactive_events` | 선제 발화 판단/전송 기록 |
| `emotional_state_snapshots` | 최근 감정 강도와 요약 |
| `safety_flags` | 안전 관련 플래그 |
| `typing_presence` | 현재 입력 중 여부 |
| `device_logins` | 장치 로그인 기록 |

## 주요 관계

```text
users
  -> sessions
      -> messages
      -> proactive_events
      -> emotional_state_snapshots
      -> typing_presence
```

`sessionId`는 거의 모든 대화 데이터의 기준입니다. Socket.IO room도 `session:${sessionId}` 형태로 나뉩니다.

## 사용자 메시지 저장

[../backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts)는 사용자 메시지를 다음 형태로 저장합니다.

- `sessionId`: 현재 인증된 세션
- `role`: `user`
- `content`: 사용자가 보낸 문자열
- `metadata`: `{ source: 'user_input' }`

저장된 메시지는 socket으로 바로 emit됩니다. 그래서 같은 세션을 보고 있는 화면은 새 사용자 메시지를 실시간으로 받을 수 있습니다.

## assistant 메시지 저장

[../backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts)는 plan의 각 메시지를 저장합니다.

- `role`: `assistant`
- `content`: 계획된 문장
- `metadata`: `{ source: 'reactive' }` 또는 `{ source: 'proactive' }`

이 metadata는 나중에 "이 메시지가 사용자 입력에 대한 반응인지, 침묵 선제 발화인지"를 구분하는 근거가 됩니다.

## typing presence

Typing은 [../frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx)에서 `/api/chat/typing`으로 전송되고, [../backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts)에서 store에 저장됩니다.

Typing은 메시지가 아닙니다. 현재 상황 판단을 돕는 휘발성 신호에 가깝습니다.

중요한 사용처:

- reactive planner가 답변을 미룹니다.
- message queue가 전송 직전 다시 확인합니다.
- proactive scheduler가 선제 발화를 피합니다.

## emotional snapshot

사용자 메시지 저장 후 [../backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts)는 백그라운드에서 최근 메시지를 요약하고 감정 강도를 저장합니다.

```text
append user message
  -> setImmediate(...)
  -> listMessages(session, 30)
  -> provider.summarizeConversationState(...)
  -> upsertEmotionalSnapshot(...)
```

요약 실패는 사용자 메시지 전송 실패로 처리하지 않습니다. 채팅 기본 흐름을 막지 않는 보조 데이터이기 때문입니다.

## 프론트 상태

[../frontend/src/store.ts](../frontend/src/store.ts)는 Zustand store를 만듭니다.

주요 값:

- `sessionId`, `userId`: 인증 후 현재 사용자/세션
- `messages`: 화면에 표시할 메시지 배열
- `assistantPresence`: assistant 상태
- `userTyping`: 입력 중 표시
- QR 등록 관련 값

프론트 상태는 화면 반응성을 위한 것입니다. 새로고침 후에는 `/api/chat/messages`로 서버 메시지를 다시 가져옵니다.

## 데이터 흐름도

```text
User input
  -> frontend local draft
  -> POST /api/chat/messages
  -> DB messages
  -> Socket.IO message event
  -> frontend Zustand messages
  -> 화면 말풍선

Assistant plan
  -> messageQueue timer
  -> DB messages
  -> Socket.IO message event
  -> frontend Zustand messages
  -> 화면 말풍선
```

## 실습

1. DB schema에서 `messages` 테이블의 컬럼을 보고, `MessageRecord` 타입과 비교합니다.
2. `store.ts`의 `appendMessage`가 기존 배열을 어떻게 갱신하는지 설명합니다.
3. `messageQueue.ts`에서 assistant 메시지 metadata source가 어디서 결정되는지 찾습니다.
4. `chatRoutes.ts`에서 요약 실패를 사용자에게 바로 반환하지 않는 이유를 설명합니다.

## 이해 확인 퀴즈

1. 기본: `sessionId`가 중요한 이유를 설명하세요.
2. 적용: proactive 메시지와 reactive 메시지를 나중에 구분하려면 어떤 값을 보면 되나요?
3. 변형: `typing_presence`를 메시지 테이블에 저장하면 어떤 문제가 생길 수 있나요?
4. 독립 수행: 사용자 메시지 1개가 화면에 보이기까지의 데이터 흐름을 DB와 Zustand를 포함해 설명하세요.

해설: [solutions/07-data-and-state-flow.md](solutions/07-data-and-state-flow.md)

## 핵심 요약

DB는 지속 데이터, Zustand는 화면 상태, Socket.IO는 실시간 전달을 맡습니다. 이 셋을 섞어 생각하면 디버깅이 어려워집니다.

다음 문서: [08-debugging-and-testing.md](08-debugging-and-testing.md)
