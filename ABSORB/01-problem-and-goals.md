# 01. 문제와 목표

## 이번 문서의 학습 목표

- 삼마고가 일반 챗봇과 다르게 다루는 문제를 이해한다.
- 현재 코드의 설계 목표와 피해야 할 방향을 구분한다.
- "무엇을 말할지"와 "언제 말할지"를 분리한 이유를 설명한다.

## 앞 문서와의 연결

[README](README.md)에서 전체 학습 순서를 봤다면, 여기서는 프로젝트가 왜 이런 구조를 갖게 됐는지부터 잡는다.

## 먼저 생각해 볼 질문

사용자가 "근데..."라고 쓰고 잠깐 멈췄을 때 AI가 바로 긴 답을 보내면 자연스러울까? 사용자가 아직 입력 중인데 예약된 후속 메시지가 도착하면 어떤 문제가 생길까?

## 핵심 문제

삼마고는 질문 1개에 답변 1개를 바로 붙이는 턴제 챗봇의 어색함을 줄이려는 프로젝트다. 특히 다음 상황을 코드로 다룬다.

- 사용자가 아직 말을 이어가려는 짧은 조각을 보냈을 때 응답을 미룬다.
- 사용자가 입력 중이면 AI 메시지를 보내지 않는다.
- 사용자가 오래 침묵할 때도 바로 재촉하지 않고 짧고 부담 낮은 메시지를 보낸다.
- 답변 하나를 길게 보내는 대신 여러 짧은 메시지로 나눌 수 있다.

관련 코드는 [backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts), [backend/src/runtime/reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts), [scheduler/src/index.ts](../scheduler/src/index.ts)에 나뉘어 있다.

## 설계 목표

| 목표 | 코드에서 보는 위치 | 의미 |
| --- | --- | --- |
| 입력 중 개입 방지 | [ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx), [chatRoutes.ts](../backend/src/routes/chatRoutes.ts), [messageQueue.ts](../backend/src/runtime/messageQueue.ts) | 프론트가 typing을 보내고, 서버가 발송 직전에 다시 확인한다. |
| 반응 타이밍 분리 | [reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts) | HTTP 요청은 `202`로 빨리 끝내고 실제 assistant 메시지는 비동기 계획으로 보낸다. |
| 선제 발화 제한 | [proactiveLoop.ts](../backend/src/runtime/proactiveLoop.ts), [scheduler/src/index.ts](../scheduler/src/index.ts) | 긴 침묵과 쿨다운 조건을 통과한 세션만 후보가 된다. |
| 로컬 실행 가능성 | [local-llm/server.py](../local-llm/server.py), [run-llm-server.ps1](../run-llm-server.ps1) | GGUF 모델을 로컬 경로로 명시해 실행한다. |
| 학습 가능한 구조 | [shared/src/index.ts](../shared/src/index.ts), [backend/src/app.ts](../backend/src/app.ts) | 타입 계약과 의존성 조립 지점을 분리한다. |

## 최초 설계 취지와 현재 코드

초기 의도는 "사람처럼 먼저 말을 걸 수도 있는 AI 채팅"이었다. 현재 구현은 그 의도를 `ConversationSnapshot`, `MultiMessagePlan`, `ProactiveDecision` 같은 구조화 타입으로 옮겼다. 제품명은 삼마고(Saammaago)지만 내부 패키지명 `@turinglet/*`와 일부 식별자는 호환성을 위해 유지된다.

## 피해야 할 방향

- 사용자가 입력 중인데 AI 메시지를 강제로 보내는 변경
- 로컬 모델 실패를 mock 응답으로 숨기는 변경
- 선제 발화를 자주 보내도록 쿨다운을 약화하는 변경
- 말동무 프로토타입을 실제 상담, 의료, 응급 서비스처럼 설명하는 변경
- 기존 데이터 규칙과 파일명을 문서와 코드에서 임의로 바꾸는 변경

## 관찰 실습

1. [backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts)의 `likelyUserWillContinue`를 읽고, 어떤 한국어 어미가 "더 말할 가능성"으로 처리되는지 적어 본다.
2. `안녕`, `근데`, `오늘 좀 힘들어서`, `여기까지`를 넣으면 각각 응답을 보낼지 미룰지 예측한다.
3. 예측한 이유를 `sendCount: 0` 또는 provider 호출 여부와 연결해 설명한다.

## 자주 헷갈리는 부분

`sendCount: 0`은 오류가 아니다. 사용자가 더 말할 가능성이 있거나 입력 중이면 일부러 아무 메시지도 보내지 않는 계획이다.

## 이해 확인 질문

- 삼마고에서 "응답 생성"과 "응답 발송 시점"은 왜 분리되어 있는가?
- 선제 발화가 항상 좋은 기능이 아닌 이유는 무엇인가?
- 이 프로젝트에서 `typing` 상태는 단순 UI 표시를 넘어 어떤 안전장치 역할을 하는가?

## 핵심 요약

삼마고의 핵심은 말의 내용보다 대화 리듬이다. 사용자가 말할 권리를 침범하지 않기 위해, 입력 중 상태와 침묵 시간을 반응 정책의 중심에 둔다.

다음 문서: [02-prerequisites.md](02-prerequisites.md)
