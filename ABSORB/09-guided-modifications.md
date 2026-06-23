# 09. 작은 수정 실습

## 학습 목표

- 요구사항을 책임 영역별로 나누어 안전하게 수정하는 연습을 한다.
- 코드 변경 전후로 테스트와 문서 갱신 대상을 판단한다.
- 큰 리팩터링 없이 정책 값을 조정하는 방법을 익힌다.

## 앞 문서와의 연결

[08-debugging-and-testing.md](08-debugging-and-testing.md)에서 문제를 좁히는 법을 봤습니다. 이번에는 작은 변경을 설계하는 연습을 합니다.

## 먼저 생각해 볼 질문

- "답장이 너무 빠르다"는 피드백은 UI 문제일까요, runtime 정책 문제일까요?
- "침묵 후 말 걸기 문구가 부담스럽다"는 피드백은 LLM 프롬프트만 바꾸면 될까요?
- 변경이 작아 보여도 테스트가 필요한 조건은 무엇일까요?

## 실습 1: continuation 대기 시간 조정

요구사항:

> 사용자가 짧게 말한 뒤 더 말할 가능성이 있으면 지금보다 조금 더 기다리게 하고 싶다.

확인할 파일:

- [../backend/src/config.ts](../backend/src/config.ts)
- [../backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts)
- [../backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)

분석:

- `USER_CONTINUATION_GRACE_MS`는 첫 reactive planning 지연 시간입니다.
- `likelyUserWillContinue`는 더 말할 가능성을 판단합니다.
- `REACTIVE_RESPONSE_MAX_WAIT_MS`는 너무 오래 기다리지 않게 하는 상한입니다.

수정 방향:

- 단순히 기본 대기 시간을 늘리는 요구라면 `config.ts` fallback 또는 `.env` 값을 조정합니다.
- 어떤 문장 끝을 더 말할 가능성으로 볼지 바꾸려면 `orchestrator.ts` 정규식을 조정합니다.

검증:

- `npm run test -w backend`
- 필요한 경우 `policy.test.ts`에 새 예시 문장 추가

## 실습 2: proactive cooldown 늘리기

요구사항:

> 먼저 말 거는 빈도를 낮추고 싶다.

확인할 파일:

- [../backend/src/config.ts](../backend/src/config.ts)
- [../scheduler/src/index.ts](../scheduler/src/index.ts)
- [../backend/src/runtime/proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts)

수정 방향:

- 조건 구조를 바꾸지 않고 빈도만 낮추려면 `PROACTIVE_COOLDOWN_MS` 값을 늘립니다.
- "처음 침묵 감지까지 더 오래 기다리기"라면 `PROACTIVE_MIN_SILENCE_MS`를 늘립니다.

주의:

- cooldown을 너무 짧게 하면 부담스러운 말 걸기가 늘어납니다.
- 너무 길게 하면 말동무형 선제 발화 실험 자체가 잘 보이지 않을 수 있습니다.

## 실습 3: 고강도 감정 침묵 문구 조정

요구사항:

> 감정 강도가 높은 침묵에서 나가는 문구를 더 짧게 바꾸고 싶다.

확인할 파일:

- [../backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)
- [../prompt-engineering/system-prompt.md](../prompt-engineering/system-prompt.md)

수정 방향:

- 현재 고강도 침묵 문구는 `planForSilence` 안의 고정 메시지입니다.
- 문구만 바꾸면 LLM 프롬프트보다 코드 메시지를 수정해야 합니다.
- 상담사처럼 진단하거나 위기 대응을 대신한다고 말하면 안 됩니다.

검증:

- `policy.test.ts`의 고강도 침묵 테스트를 확인합니다.
- 테스트가 메시지 전문을 비교하지 않더라도, 수동으로 문구가 정책에 맞는지 검토합니다.

## 실습 4: presence 문구 변경

요구사항:

> 화면의 "상대가 답변을 정리 중입니다..." 문구를 바꾸고 싶다.

확인할 파일:

- [../frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx)
- [../frontend/src/store.ts](../frontend/src/store.ts)
- [../shared/src/index.ts](../shared/src/index.ts)

수정 방향:

- presence enum 값을 바꾸는 것이 아니라 표시 문구만 바꾸면 `ChatPanel.tsx`의 `threadStatusText`만 보면 됩니다.
- enum 값을 추가하려면 shared 타입, backend emit, frontend 처리 모두 확인해야 합니다.

## 수정 전 체크리스트

- 요구사항이 UI, 정책, DB, LLM, 프롬프트 중 어디에 속하는가?
- 기존 파일명, 데이터 규칙, 실행 흐름을 바꾸는가?
- `.prompts.md`의 설계 의도와 충돌하는가?
- 테스트 또는 문서 갱신이 필요한가?
- 원본 데이터나 모델 파일을 덮어쓰는가?

## 실습

1. 위 4개 실습 중 하나를 골라 실제 변경 없이 수정 계획만 작성합니다.
2. 수정 대상 파일, 변경 이유, 검증 명령, 위험 요소를 적습니다.
3. 기존 테스트로 충분한지, 새 테스트가 필요한지 판단합니다.
4. 사용자에게 완료 보고를 한다고 가정하고 "변경 이유" 문단을 작성합니다.

## 이해 확인 퀴즈

1. 기본: `.env` 값 조정과 코드 로직 변경의 차이를 설명하세요.
2. 적용: proactive 빈도만 낮추려면 어떤 환경 변수를 먼저 봐야 하나요?
3. 변형: presence에 새 상태 `listening`을 추가하면 어떤 파일들을 확인해야 하나요?
4. 독립 수행: "짧은 인사에는 답하고, 열린 문장에는 기다리기" 정책을 바꾸는 수정 계획을 작성하세요.

해설: [solutions/09-guided-modifications.md](solutions/09-guided-modifications.md)

## 핵심 요약

작은 수정은 책임 영역을 정확히 찾는 것이 절반입니다. 값을 조정하면 되는 일을 구조 변경으로 키우지 않는 것이 이 repo의 중요한 작업 원칙입니다.

다음 문서: [10-reimplementation.md](10-reimplementation.md)
