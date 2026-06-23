# 07 해설: 데이터와 상태 흐름

## 1. 기본

`sessionId`는 사용자 대화 흐름을 구분하는 핵심 키다. DB 메시지, typing presence, emotional snapshot, proactive event, socket room이 모두 session 단위로 연결된다.

## 2. 적용

assistant 메시지의 `metadata.source`를 보면 `reactive`인지 `proactive`인지 구분할 수 있다. 값은 [../../backend/src/runtime/messageQueue.ts](../../backend/src/runtime/messageQueue.ts)에서 저장된다.

## 3. 변형

`typing_presence`를 메시지 테이블에 넣으면 대화 기록에 휘발성 상태가 섞인다. typing은 자주 바뀌고 오래 보존할 필요가 약하므로 별도 상태로 다루는 편이 맞다.

## 4. 독립 수행

흐름 예시:

```text
draft 입력
-> POST /api/chat/messages
-> messages 테이블 저장
-> socket message emit
-> frontend socket handler
-> Zustand messages append
-> 화면 말풍선 렌더링
```

좋은 답에는 DB 저장과 프론트 local state 반영이 모두 포함되어야 한다.
