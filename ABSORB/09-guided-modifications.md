# 09. guided modifications

## 이번 문서의 학습 목표

- 작은 수정으로 프로젝트 동작을 관찰하는 방법을 익힌다.
- 변경 전후에 어떤 테스트와 수동 확인이 필요한지 판단한다.
- 기능 추가가 아니라 기존 의도를 보존하는 수정을 연습한다.

## 앞 문서와의 연결

[08-debugging-and-testing.md](08-debugging-and-testing.md)에서 검증 방법을 봤다. 이제 실제로 바꿔 볼 수 있는 작은 지점을 고른다.

## 먼저 생각해 볼 질문

응답 타이밍을 더 빠르게 만들고 싶을 때, 프론트 UI부터 바꿔야 할까, backend 설정값부터 봐야 할까?

## 실습 1. continuation 판단 관찰

대상 파일: [backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)

목표: 어떤 문장이 "더 말할 가능성"으로 처리되는지 이해한다.

단계:

1. `likelyUserWillContinue`의 정규식을 읽는다.
2. `근데`, `그래서`, `오늘은 괜찮아`, `다 말했어`의 결과를 예측한다.
3. 테스트를 추가하지 않고 코드를 바꾸지는 않는다. 먼저 현재 기준을 설명한다.
4. 정말 수정한다면 특정 어미 하나만 추가하거나 제거하고, [backend/tests/policy.test.ts](../backend/tests/policy.test.ts)에 기대값을 추가한다.

확인 기준: `sendCount: 0`으로 미뤄지는 경우와 provider plan으로 넘어가는 경우를 구분할 수 있어야 한다.

## 실습 2. proactive 침묵 시간 조정

대상 파일: [.env.example](../.env.example), [backend/src/config.ts](../backend/src/config.ts), [scheduler/src/index.ts](../scheduler/src/index.ts)

목표: 설정값과 정책 코드의 경계를 이해한다.

단계:

1. `.env.example`에서 `PROACTIVE_MIN_SILENCE_MS`를 찾는다.
2. [config.ts](../backend/src/config.ts)가 이 값을 어떻게 읽는지 확인한다.
3. [scheduler/src/index.ts](../scheduler/src/index.ts)는 값 자체가 아니라 input으로 받은 `minSilenceMs`를 사용한다는 점을 확인한다.
4. 실험할 때는 실제 `.env`에서만 값을 바꾸고, 기본값 변경은 신중히 한다.

확인 기준: 침묵 시간이 짧아졌을 때 선제 발화가 너무 자주 생길 수 있음을 설명할 수 있어야 한다.

## 실습 3. assistant presence 문구 바꾸기

대상 파일: [frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx)

목표: UI 문구만 바꾸는 수정과 정책 수정의 차이를 이해한다.

단계:

1. `threadStatusText`를 찾는다.
2. `thinking`, `organizing`, `typing`의 표시 문구를 확인한다.
3. 문구를 바꾸더라도 `PresenceState` type은 그대로 둘 수 있는지 판단한다.
4. 변경 후 브라우저에서 상태 표시가 길어져 레이아웃을 깨지 않는지 확인한다.

확인 기준: UI 문구 수정은 backend 정책을 바꾸지 않는다는 점을 설명할 수 있어야 한다.

## 실습 4. 발송 직전 typing 확인 추적

대상 파일: [backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts)

목표: race condition 방지 장치를 이해한다.

단계:

1. `setTimeout` 내부의 첫 조건을 찾는다.
2. 사용자가 delay 동안 다시 입력을 시작하면 어떤 일이 일어나는지 설명한다.
3. 이 조건을 제거하면 어떤 문제가 생길지 적는다.
4. 실제 수정은 하지 않는다. 이 코드는 핵심 안전장치다.

확인 기준: "예약할 때 typing이 아니었더라도 발송 직전에는 typing일 수 있다"는 점을 설명할 수 있어야 한다.

## 실습 5. 작은 테스트 추가

대상 파일: [backend/tests/policy.test.ts](../backend/tests/policy.test.ts)

목표: 정책 변경을 테스트로 보호한다.

단계:

1. 기존 테스트의 describe/it 구조를 읽는다.
2. continuation 또는 proactive decision 중 하나의 edge case를 고른다.
3. 입력 snapshot을 명확히 만들고 기대 결과를 적는다.
4. `npm test`를 실행한다.

예상 결과: 테스트가 통과하면 정책이 기대대로 동작한다. 실패하면 오류 메시지 원문과 입력 조건을 함께 기록한다.

## 자주 헷갈리는 부분

작은 수정이어도 정책 파일을 건드리면 문서와 테스트도 함께 봐야 한다. 반대로 단순 UI 문구 변경은 전체 교재를 갱신할 필요가 없을 수 있다.

## 이해 확인 질문

- 설정값 변경과 코드 정책 변경은 어떻게 구분하는가?
- 발송 직전 typing 확인은 왜 테스트보다 수동 시나리오로도 확인해야 하는가?
- 문구 변경이 사용자의 기대 행동을 바꿀 수 있는 경우는 언제인가?

## 핵심 요약

수정은 작게 시작하고, 관찰 가능한 결과와 검증 명령을 먼저 정한다. 삼마고에서는 특히 typing과 proactive 정책을 가볍게 바꾸지 않는다.

다음 문서: [10-reimplementation.md](10-reimplementation.md)
