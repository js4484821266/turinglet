# 09 해설: 작은 수정 실습

## 1. 기본

`.env` 값 조정은 같은 코드 로직에 다른 운영 값을 넣는 변경이다. 코드 로직 변경은 판단 조건 자체를 바꾸므로 테스트와 문서 영향이 더 클 수 있다.

## 2. 적용

proactive 빈도만 낮추려면 먼저 `PROACTIVE_COOLDOWN_MS`를 본다. 처음 말 걸기까지의 최소 침묵 시간을 늘리고 싶다면 `PROACTIVE_MIN_SILENCE_MS`를 본다.

근거 코드: [../../backend/src/config.ts](../../backend/src/config.ts), [../../scheduler/src/index.ts](../../scheduler/src/index.ts)

## 3. 변형

새 presence `listening`을 추가하려면 최소한 다음을 확인한다.

- [../../shared/src/index.ts](../../shared/src/index.ts)의 `PresenceState`
- backend에서 emit하는 위치
- [../../frontend/src/store.ts](../../frontend/src/store.ts)의 상태 타입
- [../../frontend/src/components/ChatPanel.tsx](../../frontend/src/components/ChatPanel.tsx)의 표시 문구

## 4. 독립 수행

좋은 수정 계획에는 다음이 있어야 한다.

- `orchestrator.ts`의 standalone utterance와 continuation 판단 수정
- "짧은 인사"와 "열린 문장" 각각의 테스트 예시
- `npm run test -w backend` 검증
- 문구나 정책 의도가 바뀌면 ABSORB 관련 문서 갱신 여부 검토
