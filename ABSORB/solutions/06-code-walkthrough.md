# 06 해설: 코드 읽기 순서

## 1. 기본

[../../backend/src/app.ts](../../backend/src/app.ts)는 store, provider, orchestrator, scheduler, route, socket을 한 곳에서 연결한다. 개별 route가 직접 의존성을 만들지 않게 해서 테스트와 책임 분리가 쉬워진다.

## 2. 적용

계획을 세운 뒤 실제 전송까지 시간이 지나기 때문에 사용자가 그 사이 입력을 시작할 수 있다. [../../backend/src/runtime/messageQueue.ts](../../backend/src/runtime/messageQueue.ts)의 전송 직전 typing 확인은 이런 끼어들기를 막는다.

## 3. 변형

`reactiveSequence`가 없으면 이전 메시지의 오래된 timer가 나중에 실행되어 최신 사용자 입력보다 뒤늦게 잘못된 응답을 만들 수 있다. sequence는 세션별 최신 예약만 유효하게 만든다.

## 4. 독립 수행

의사코드 예시:

```ts
if (snapshot.userTyping) return emptyPlan("typing");
if (likelyUserWillContinue(userText)) return emptyPlan("continuation");
return provider.generateMultiMessagePlan({ snapshot, userText });
```

평가 기준: typing 확인, continuation 확인, provider 위임이 순서대로 있어야 한다.
