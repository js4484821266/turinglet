# 04. 실행 흐름

## 학습 목표

- 백엔드와 프론트엔드가 시작되는 순서를 설명한다.
- 사용자 메시지가 실제 assistant 메시지로 바뀌는 흐름을 추적한다.
- reactive 흐름과 proactive 흐름을 구분한다.

## 앞 문서와의 연결

[03-project-map.md](03-project-map.md)에서 파일 지도를 만들었습니다. 이번에는 그 파일들이 실행 중 어떤 순서로 호출되는지 봅니다.

## 먼저 생각해 볼 질문

- `/api/chat/messages` POST는 assistant 답변까지 기다린 뒤 응답할까요?
- Socket.IO는 왜 필요한가요?
- 선제 발화는 사용자의 새 HTTP 요청 없이도 발생할 수 있을까요?

## 앱 시작 흐름

백엔드 시작점은 [../backend/src/server.ts](../backend/src/server.ts)입니다.

```text
server.ts
  -> waitForLocalLlm()
  -> createApp()
  -> http.createServer(app)
  -> attachSocket(server)
  -> bindSocket(io)
  -> server.listen(...)
  -> startScheduler()
```

중요한 점은 LLM 서버 health check를 먼저 기다린다는 것입니다. 로컬 LLM이 없으면 메시지 생성 관련 기능을 정상적으로 수행할 수 없기 때문입니다.

[../backend/src/app.ts](../backend/src/app.ts)는 조립 지점입니다. store, provider, generator, orchestrator, realtime emitter, queue, reactive planner, proactive scheduler를 만들고 route에 주입합니다.

## 사용자 메시지 reactive 흐름

```text
ChatPanel.sendMessage()
  -> POST /api/chat/messages
  -> chatRoutes.ts가 user message 저장
  -> emitMessage(userMessage)
  -> scheduleReactivePlan(...)
  -> HTTP 202 accepted 반환

잠시 후 reactivePlanner timer 실행
  -> typing 상태 확인
  -> presence: thinking 또는 organizing
  -> orchestrator.planForUserMessage(...)
  -> 필요하면 provider.generateMultiMessagePlan(...)
  -> messageQueue.queuePlanMessages(...)
  -> delayMs 이후 assistant message 저장
  -> Socket.IO로 message 이벤트 전송
```

핵심은 API 응답과 assistant 응답 생성이 분리되어 있다는 점입니다. [../backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts)는 사용자 메시지를 저장한 뒤 `202`를 반환하고, 실제 assistant 메시지는 나중에 Socket.IO로 도착합니다.

## 사용자 typing 흐름

```text
ChatPanel.onDraftChange()
  -> POST /api/chat/typing { isTyping: true }
  -> 4초 뒤 false 전송 예약
  -> backend store에 typing_presence 저장
  -> emitUserTyping(...)
  -> reactivePlanner가 typing이면 기다림
```

프론트의 typing 표시는 사용자에게 보이는 UI일 뿐 아니라, 백엔드 반응 정책의 입력이 됩니다.

## 침묵 proactive 흐름

```text
startScheduler()
  -> setInterval(runProactiveLoop)
  -> active session 목록 조회
  -> snapshot 조회
  -> evaluateProactiveDecision(...)
  -> 조건 불만족이면 skip
  -> 최근 메시지로 silenceMeaning 추론
  -> planForSilence(...)
  -> queuePlanMessages(...)
  -> proactive event 기록
```

선제 발화는 새 사용자 요청이 없어도 실행됩니다. 대신 [../scheduler/src/index.ts](../scheduler/src/index.ts)가 최소 침묵 시간, cooldown, typing 여부를 먼저 검사합니다.

## 메시지 전송 큐

[../backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts)는 plan 안의 `delayMs`를 실제 타이머로 바꿉니다. 메시지를 보내기 직전 다시 `isUserTyping`을 확인합니다. 사용자가 그 사이에 다시 입력을 시작하면 assistant 메시지는 보내지 않습니다.

이 마지막 확인은 중요합니다. 계획을 세운 시점에는 괜찮았더라도, 전송 직전 상황이 바뀔 수 있기 때문입니다.

## 프론트 수신 흐름

[../frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx)는 socket에 연결한 뒤 `join_session`을 보냅니다.

받는 이벤트:

- `message`: 새 메시지를 Zustand store에 append
- `presence`: assistant 상태를 `thinking`, `organizing`, `waiting` 등으로 갱신
- `user_typing`: 사용자 typing 상태 표시

## 실습

1. 사용자가 "오늘 좀 힘들었어"를 보냈다고 가정하고, 위 reactive 흐름의 각 단계에 실제 파일명을 붙여봅니다.
2. `reactivePlanner.ts`에서 `config.userContinuationGraceMs`가 어디에 쓰이는지 찾습니다.
3. `messageQueue.ts`에서 메시지를 보내기 직전 typing을 다시 확인하는 줄을 찾습니다.
4. `ChatPanel.tsx`에서 REST 요청과 Socket.IO 수신이 동시에 쓰이는 이유를 설명합니다.

## 이해 확인 퀴즈

1. 기본: `/api/chat/messages`가 `202`를 반환하는 이유를 설명하세요.
2. 적용: assistant 메시지가 DB에는 저장됐지만 화면에 안 보인다면 어떤 흐름을 확인해야 하나요?
3. 변형: `delayMs`가 5000인 메시지 계획이 생긴 뒤 사용자가 2초 뒤 다시 입력을 시작했습니다. 어떤 파일의 어떤 조건이 전송을 막을 수 있나요?
4. 독립 수행: reactive 흐름을 8단계 이내의 순서도로 다시 그려보세요.

해설: [solutions/04-execution-flow.md](solutions/04-execution-flow.md)

## 핵심 요약

삼마고의 응답은 HTTP 요청 안에서 즉시 완성되지 않습니다. 요청 수락, 반응 계획, 지연 전송, 실시간 수신이 분리되어 대화 타이밍을 제어합니다.

다음 문서: [05-core-concepts.md](05-core-concepts.md)
