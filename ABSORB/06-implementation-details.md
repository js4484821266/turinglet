# 06. 구현 세부사항

## 이번 문서의 학습 목표

이 문서는 삼마고의 핵심 알고리즘과 기술적 판단을 설명한다. 목표는 코드를 수정할 때 단순히 "돌아가게" 만드는 것이 아니라, 원래의 대화 정책을 보존하면서 고칠 수 있게 되는 것이다.

## 앞 문서와의 연결

[05-data-flow.md](05-data-flow.md)에서 데이터가 저장되고 읽히는 흐름을 봤다. 이제 그 데이터를 사용해 어떤 판단을 내리는지 본다.

## 사용자가 이어 말할 가능성 판단

[backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)의 `likelyUserWillContinue`는 LLM 호출 전에 간단한 규칙으로 응답 보류 여부를 판단한다.

주요 단서는 다음과 같다.

- 너무 짧은 조각 문장
- `그리고`, `근데`, `그래서` 같은 연결어로 끝나는 문장
- `인데`, `같아서`, `하려고`, `는데` 같은 열린 어미
- 말줄임표나 쉼표처럼 이어질 가능성이 있는 끝맺음
- standalone 인사나 확인 응답은 예외 처리

이 규칙은 사용자가 아직 말을 정리 중일 때 assistant가 끼어드는 것을 줄이기 위한 장치다. 한국어 대화 리듬을 다루는 부분이므로 수정할 때는 예시 문장을 함께 테스트하는 편이 좋다.

## reactive planner의 재시도 구조

[backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts)는 사용자 메시지 직후 바로 LLM을 호출하지 않는다.

1. 첫 시도는 `USER_CONTINUATION_GRACE_MS`만큼 기다린다.
2. typing 중이면 최대 20번까지 900ms 간격으로 다시 예약한다.
3. typing이 아니면 presence를 `thinking`으로 바꾼다.
4. `ConversationOrchestrator.planForUserMessage`로 plan을 받는다.
5. `sendCount: 0`이고 계속 기다릴 이유가 있으면 `REACTIVE_RESPONSE_MAX_WAIT_MS` 안에서 재시도한다.
6. 너무 오래 기다렸으면 provider plan을 강제로 받아 queue에 넣는다.

이 구조 때문에 사용자 입장에서는 "보내기 버튼을 눌렀는데 HTTP는 성공했고, assistant 답장은 나중에 도착"하는 경험이 된다.

## proactive decision

[scheduler/src/index.ts](../scheduler/src/index.ts)의 `evaluateProactiveDecision`은 다음 순서로 판단한다.

1. 사용자가 typing 중이면 보내지 않는다.
2. 아직 user message가 없으면 보내지 않는다.
3. 침묵 시간이 `minSilenceMs`보다 짧으면 보내지 않는다.
4. 최근 outreach가 cooldown 안이면 보내지 않는다.
5. 감정 강도가 높으면 `high_emotional_load`, 아니면 `proactive_checkin_candidate`로 제안한다.

이 판단은 독립 패키지에 있어 테스트하기 쉽다. 실제 active session 순회와 LLM silence meaning 추론은 [backend/src/runtime/proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts)가 담당한다.

## message queue의 마지막 typing 검사

[backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts)는 plan을 timer로 예약한다. 각 timer가 실행될 때 다시 `isUserTyping`을 확인한다.

이 마지막 검사는 중요하다. reactive planner가 plan을 만들 당시에는 typing이 아니었더라도, 사용자가 그 사이 다시 입력을 시작했을 수 있기 때문이다.

## MultiMessagePlan의 의미

[shared/src/index.ts](../shared/src/index.ts)의 `MultiMessagePlan`은 assistant 반응을 하나의 문자열이 아니라 여러 instruction으로 표현한다.

```ts
interface MultiMessagePlan {
  sendCount: number;
  reason: string;
  nextState: SessionMachineState;
  messages: OutboundMessageInstruction[];
}
```

각 `OutboundMessageInstruction`은 `content`, `delayMs`, `presenceBeforeSend`, `metadata`를 가질 수 있다. 이 구조 덕분에 "짧은 공감 한 줄을 먼저 보내고 잠시 뒤 질문" 같은 대화 리듬을 표현할 수 있다.

## LLM 결과 검증

[backend/src/adapters/hfLocalProvider.ts](../backend/src/adapters/hfLocalProvider.ts)는 local LLM 서버의 응답을 그대로 믿지 않는다. `summary`, `silence_meaning`, `multi_plan`마다 반환 타입을 검사한다.

[backend/src/adapters/hfLocalValidation.ts](../backend/src/adapters/hfLocalValidation.ts)는 다음 enum을 제한한다.

- `PresenceState`: `typing`, `thinking`, `organizing`, `waiting`
- `SessionMachineState`: `idle`, `waiting_after_empathy`, `user_typing`, `reflective_pause`, `proactive_checkin_candidate`, `cooldown_after_outreach`, `high_emotional_load`
- `SilenceMeaning`: `crying`, `organizing_thoughts`, `emotionally_overwhelmed`, `away`, `typing`

LLM output은 불안정할 수 있으므로 이 검증 계층을 없애면 런타임 상태가 오염될 수 있다.

## local-llm 서버의 fallback

[local-llm/server.py](../local-llm/server.py)는 모델이 JSON을 정확히 내지 못할 때 일부 task에서 fallback을 제공한다.

- `summary`: JSON이 아니면 모델 text를 요약 문자열로 쓰고 intensity를 5로 둔다.
- `multi_plan`: JSON이 아니면 모델 text를 단일 메시지 plan으로 감싼다.
- `silence_meaning`: 허용 enum이 아니면 `organizing_thoughts`로 둔다.

다만 `multi_plan`에서 유효한 메시지가 하나도 없으면 오류를 반환한다. 실패를 정상 결과처럼 감추지 않기 위한 최소한의 검증이다.

## GGUF 모델 경로

local LLM 서버는 [local-llm/server.py](../local-llm/server.py) 시작 시 `HF_MODEL_PATH`를 검사한다.

- 값이 없으면 실패한다.
- 파일이 없으면 실패한다.
- 파일이 아니면 실패한다.
- 크기가 0이면 실패한다.
- 확장자가 `.gguf`가 아니면 실패한다.

이 프로젝트는 실행 중 모델 자동 다운로드를 하지 않는다. 모델 파일 준비는 사용자 또는 배포 절차가 명시적으로 수행해야 한다.

## QR 인증과 관리자 BMP 인증

일반 사용자는 [authRoutes.ts](../backend/src/routes/authRoutes.ts)의 QR payload 기반으로 로그인한다. QR payload는 토큰 자체를 담고, DB에는 token hash가 저장된다.

관리자는 완전히 다른 경로를 쓴다. [adminRoutes.ts](../backend/src/routes/adminRoutes.ts)는 이번 실행에서 생성한 64x64 1-bit BMP와 업로드된 BMP의 digest를 비교한다. token은 서버 메모리의 `Set`에만 저장되므로 서버가 재시작되면 관리자 세션도 사라진다.

## rate limit

[backend/src/rateLimit.ts](../backend/src/rateLimit.ts)는 in-memory IP bucket 방식이다. 단일 로컬 프로세스에는 충분하지만, production 다중 인스턴스에서는 공유 저장소가 아니므로 한계가 있다.

## 자주 헷갈리는 부분

`planForSilence`의 고감정 메시지는 provider를 거치지 않고 규칙 기반 고정 메시지를 반환한다. 반대로 일반 사용자 메시지 reactive plan은 continuation 판단 후 provider의 `generateMultiMessagePlan`을 호출한다.

`local-llm/server.py`의 prompt 문구와 [prompt-engineering/](../prompt-engineering/) 문서가 완전히 자동 연결된 것은 아니다. prompt 문서는 설계 기준이고, 실제 실행 prompt는 Python 서버 코드 안에 들어 있다.

## 반드시 이해해야 할 요점

- 끼어들지 않는 정책은 reactive planner, orchestrator, message queue에 중복 방어로 들어 있다.
- 선제 발화는 silence, cooldown, typing, silence meaning을 모두 통과해야 한다.
- LLM output은 항상 검증하고 정규화해야 한다.
- 모델 파일은 명시 경로 기반이며 자동 다운로드하지 않는다.

## 다음 문서

다음은 [07-testing-and-debugging.md](07-testing-and-debugging.md)에서 검증 방법과 오류 대응을 배운다.

