# 12. 원본 코드 추적 실습

## 학습 목표

- 설명용 의사코드가 아니라 현재 저장소의 실제 코드를 읽는다.
- HTTP 수락, 반응 계획, 지연 전송, 선제 발화의 경계를 함수 호출로 추적한다.
- 정상 흐름과 실패 흐름에서 어떤 값과 로그를 확인해야 하는지 설명한다.

## 앞 문서와의 연결

[11-explain-it-yourself.md](11-explain-it-yourself.md)까지는 프로젝트 전체를 설명하는 연습이었습니다. 이번 장에서는 그 설명을 실제 코드로 증명합니다. 아래 스니펫은 2026-06-25 현재 링크된 원본 파일에서 그대로 가져왔습니다. 생략한 import나 주변 코드는 스니펫 위에 범위를 표시하며, 코드 자체를 설명용으로 고쳐 쓰지 않았습니다.

## 먼저 생각해 볼 질문

- backend가 포트를 열기 전에 로컬 LLM을 확인하는 이유는 무엇인가요?
- `202 Accepted`와 assistant 답변 완료는 왜 다른 사건인가요?
- 계획을 만든 뒤에도 전송 직전에 typing을 다시 확인해야 하는 이유는 무엇인가요?

## 1. 시작 실패를 정상 서비스로 숨기지 않기

원본: [../backend/src/server.ts](../backend/src/server.ts), `main()`

```ts
async function main(): Promise<void> {
  await waitForLocalLlm();

  const { app, startScheduler, bindSocket } = createApp();
  const server = http.createServer(app);
  const io = attachSocket(server);
  bindSocket(io);

  server.listen(config.port, '0.0.0.0', () => {
    startScheduler();
    console.log(`Backend listening on http://0.0.0.0:${config.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

이 코드는 프로세스 시작 때 실행됩니다. `waitForLocalLlm()`이 resolve되어야 `createApp()`과 `server.listen()`으로 진행합니다. 입력은 환경 변수로 정해진 LLM 주소와 timeout 설정이고, 성공 시 HTTP 서버와 proactive scheduler가 시작되는 부작용이 생깁니다.

실패 경계는 세 곳입니다.

1. LLM health가 준비되지 않으면 포트를 열지 않습니다.
2. `createApp()`이 DB 설정이나 production build 문제로 실패할 수 있습니다.
3. 최상위 catch는 오류를 기록하고 `process.exitCode`를 설정하지만 IDE 흐름을 `process.exit()`로 즉시 끊지 않습니다.

확인할 값은 LLM health 로그, `config.port`, `Backend listening` 로그입니다. 모델이 없는데 backend health가 열린다면 이 순서가 깨진 것입니다.

확인 질문: `waitForLocalLlm()`을 `server.listen()` 뒤로 옮기면 사용자가 어떤 잘못된 상태를 보게 될까요?

## 2. 사용자 메시지는 저장 후 비동기로 계획된다

원본: [../backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts), `POST /api/chat/messages`의 핵심 구간

```ts
const userMessage = await deps.store.appendMessage({
  sessionId: identity.sessionId,
  role: 'user',
  content: parsed.data.content,
  metadata: { source: 'user_input' }
});
deps.emitMessage(userMessage);
deps.scheduleReactivePlan({ sessionId: identity.sessionId, userText: parsed.data.content });

res.status(202).json({
  accepted: true,
  planReason: 'deferred_reactive_planning',
  sendCount: null
});
```

입력은 인증된 `sessionId`와 Zod 검증을 통과한 `content`입니다. 먼저 DB에 user message를 append하고 Socket.IO로 같은 세션에 알립니다. 그 다음 reactive timer를 예약한 뒤 assistant 계획을 기다리지 않고 202를 반환합니다.

`sendCount: null`은 아직 계획이 없다는 뜻입니다. 이 값을 0으로 바꾸면 “보내지 않기로 결정함”과 “아직 결정 전”을 구분하지 못합니다. DB append가 실패하면 202까지 가지 않지만, 이후 timer 안의 LLM 실패는 이미 끝난 HTTP 응답을 되돌릴 수 없습니다.

예시 입력이 `"오늘 좀 힘들었어"`라면 `userMessage.content`는 그대로 저장되고, `scheduleReactivePlan.userText`에도 같은 문자열이 전달됩니다. assistant 결과는 이후 queue와 Socket.IO를 통해 도착합니다.

확인 질문: 이 route에서 LLM 생성까지 `await`하면 응답 시간과 사용자 후속 입력 처리에 어떤 영향이 생길까요?

## 3. 오래된 reactive 계획 무효화

원본: [../backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts), `scheduleReactivePlan()` 일부

```ts
const attempt = input.attempt ?? 0;
const sequence = input.sequence ?? (reactiveSequence.get(input.sessionId) ?? 0) + 1;
const startedAt = input.startedAt ?? Date.now();
reactiveSequence.set(input.sessionId, sequence);

clearReactivePlanTimer(input.sessionId);
const delay = attempt === 0 ? config.userContinuationGraceMs : 900;

const timer = setTimeout(async () => {
  if (reactiveSequence.get(input.sessionId) !== sequence) return;
```

`sequence`는 세션별 계획 세대 번호입니다. 새 사용자 메시지가 들어오면 값이 증가하고 이전 timer를 지웁니다. 이미 실행 대기열에 들어간 callback까지 완전히 취소되지 않을 수 있으므로 callback 시작 시 현재 sequence를 다시 비교합니다.

첫 호출에서 저장값이 없다면 sequence는 1입니다. 새 메시지가 오면 2가 되고, 이전 callback이 늦게 실행되어도 `2 !== 1`이므로 즉시 끝납니다. 이 검사가 없으면 첫 메시지용 답변이 두 번째 메시지 뒤에 도착할 수 있습니다.

디버깅할 때는 `sessionId`, `attempt`, `sequence`, `startedAt`, typing 상태를 함께 기록해야 합니다. timer 개수만 보면 어떤 계획이 최신인지 알 수 없습니다.

확인 질문: timer를 취소하는데도 sequence 비교가 필요한 경쟁 상태를 자신의 말로 설명하세요.

## 4. 선제 발화의 분기 우선순위

원본: [../scheduler/src/index.ts](../scheduler/src/index.ts), `evaluateProactiveDecision()`

```ts
export function evaluateProactiveDecision(input: ProactiveDecisionInput): ProactiveDecision {
  const state = resolveState(input);

  if (input.snapshot.userTyping) {
    return {
      shouldSend: false,
      reason: 'User is typing; avoid interruption.',
      suggestedState: state
    };
  }

  if (!input.snapshot.lastUserMessageAt) {
    return {
      shouldSend: false,
      reason: 'No user speech yet; no outreach.',
      suggestedState: 'idle'
    };
  }

  const silenceMs = input.now - input.snapshot.lastUserMessageAt;
```

이 함수는 DB나 LLM을 호출하지 않는 순수 정책 함수입니다. 같은 입력에는 같은 결과가 나옵니다. 분기 순서 자체가 우선순위입니다. 입력 중이면 침묵 시간이 길어도 즉시 중단하고, 사용자 발화 기록이 없으면 먼저 말을 걸지 않습니다. 그 다음에야 침묵 길이와 cooldown을 계산합니다.

정상 예시에서 `userTyping=false`, 마지막 사용자 메시지가 200초 전, 최소 침묵이 120초라면 다음 cooldown 분기로 진행합니다. 경계 조건은 `silenceMs === minSilenceMs`입니다. 코드가 `<`를 사용하므로 정확히 같을 때는 침묵 조건을 통과합니다.

확인 질문: `lastUserMessageAt` 검사를 `silenceMs` 계산 뒤로 옮기면 `undefined`가 어떤 계산 결과를 만들 수 있나요?

## 5. 전송 직전 마지막 typing 확인

원본: [../backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts), `queuePlanMessages()` 핵심 구간

```ts
const timers = input.messages.map((item) =>
  setTimeout(async () => {
    if (await deps.store.isUserTyping(input.sessionId)) return;

    if (item.presenceBeforeSend) deps.emitPresence(input.sessionId, item.presenceBeforeSend);
    const message = await deps.store.appendMessage({
      sessionId: input.sessionId,
      role: 'assistant',
      content: item.content,
      metadata: { source: input.source }
    });
    deps.emitMessage(message);
    deps.emitPresence(input.sessionId, 'waiting');
  }, item.delayMs)
);
```

계획 시점과 전송 시점 사이에는 `delayMs`가 있습니다. 그 사이 사용자가 다시 입력할 수 있으므로 queue는 DB의 최신 typing 상태를 확인합니다. false일 때만 presence 전송, assistant message 저장, Socket.IO message 전송, waiting 복귀 순서로 진행합니다.

부작용 순서가 중요합니다. DB 저장보다 socket emit이 먼저라면 새로고침 후 메시지가 사라질 수 있습니다. 현재 코드는 저장된 `MessageRecord`를 emit하므로 DB와 화면이 같은 id와 시각을 공유합니다.

경계 조건은 typing이 true일 때 timer가 메시지를 재예약하지 않고 종료한다는 점입니다. 이는 끼어들기 방지에는 안전하지만 해당 계획이 사라질 수 있음을 뜻합니다. 이 동작을 바꾸려면 중복 전송과 무한 재예약을 함께 테스트해야 합니다.

확인 질문: `isUserTyping()` 검사를 plan 생성 시점에만 하면 왜 충분하지 않은가요?

## 6. Python 모델 호출 직렬화

원본: [../local-llm/server.py](../local-llm/server.py), `LLM_LOCK`과 `_chat()` 일부

```python
LLM_LOCK = Lock()


def _chat(system: str, user: str, max_tokens: int = 200, temperature: float = 0.7) -> str:
    """Generate a response using the chat-completion interface."""
    try:
        # llama-cpp-python shares native state inside the Llama object. FastAPI
        # can run sync handlers concurrently, so serialize generation calls to
        # avoid ggml asserts from overlapping requests.
        with LLM_LOCK:
            output = llm.create_chat_completion(
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=0.9,
                repeat_penalty=1.05,
            )
```

FastAPI가 여러 요청을 받을 수 있어도 전역 `Llama` 객체의 native 추론 상태는 안전하게 겹쳐 쓸 수 없다는 전제입니다. lock은 한 번에 한 생성만 실행해 처리량을 낮추는 대신 `GGML_ASSERT`, 연결 reset, LLM 프로세스 종료 위험을 줄입니다.

입력은 system/user prompt와 생성 설정이고, 출력은 이어지는 코드에서 `choices[0].message.content`로 추출됩니다. 모델 형식이 다르거나 choices가 비어 있으면 예외가 나고 로그에 stack trace가 남습니다.

확인 질문: backend timeout보다 lock 대기와 생성 시간이 길어지면 사용자는 어떤 오류를 볼 수 있으며 어느 로그부터 확인해야 하나요?

## 능동 실습

1. 위 각 스니펫을 원본 링크에서 찾아 한 글자라도 다른 부분이 있는지 대조합니다.
2. `"근데"`를 보냈을 때 route부터 reactive sequence까지 변수값을 종이에 적습니다.
3. 같은 세션에서 500ms 간격으로 두 메시지가 왔다고 가정하고 sequence 변화를 추적합니다.
4. proactive 입력에서 `userTyping`, `lastUserMessageAt`, `lastOutreachAt`을 하나씩 바꿔 결과를 예측한 뒤 [../backend/tests/policy.test.ts](../backend/tests/policy.test.ts)의 방식으로 검증합니다.
5. 원본을 닫고 “저장 후 emit” 순서를 지키는 작은 queue 함수를 다시 작성합니다.

## 이해 확인 퀴즈

1. 기본: 202 응답이 보장하는 것과 보장하지 않는 것을 구분하세요.
2. 적용: sequence가 없을 때 발생 가능한 메시지 순서 오류를 시간 순서로 설명하세요.
3. 변형: queue의 DB append가 성공하고 Socket.IO emit이 실패하면 DB와 화면은 각각 어떤 상태인가요?
4. 오류 찾기: LLM health는 성공하지만 첫 생성 요청이 timeout이라면 확인할 설정과 로그를 순서대로 적으세요.
5. 독립 수행: reactive와 proactive가 같은 `queuePlanMessages`에 도착하기까지의 서로 다른 호출 경로를 파일명과 함수명으로 작성하세요.

해설: [solutions/12-original-code-lab.md](solutions/12-original-code-lab.md)

## 핵심 요약

삼마고의 핵심은 생성 모델 하나가 아니라 여러 시간 경계입니다. 시작 전 health, HTTP 수락 뒤 계획, 새 입력에 의한 계획 무효화, 전송 직전 typing 확인, native 모델 호출 직렬화를 구분해야 실제 오류를 좁힐 수 있습니다.

교재 목차로 돌아가기: [README.md](README.md)
