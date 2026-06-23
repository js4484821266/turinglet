# 11. 자기 말로 설명하기

## 이번 문서의 학습 목표

- 프로젝트를 과장 없이 설명하는 연습을 한다.
- 코드 링크를 근거로 기술 선택을 설명한다.
- 모르는 부분과 확인한 부분을 구분한다.

## 앞 문서와의 연결

[10-reimplementation.md](10-reimplementation.md)에서 핵심 정책을 다시 구현해 봤다. 이제 설명할 수 있는지 점검한다.

## 30초 설명

삼마고는 사용자가 메시지를 보내면 바로 한 번 답하는 일반 챗봇이 아니라, typing 상태와 침묵 시간, 감정 강도, 쿨다운을 보고 응답 타이밍을 조절하는 AI 말동무 프로토타입입니다. React 프론트엔드에서 메시지와 typing을 보내고, Express 백엔드는 메시지를 저장한 뒤 reactive planner와 message queue를 통해 지연 응답을 보냅니다. 긴 침묵에는 scheduler가 조건을 확인해 부담 낮은 선제 메시지를 제한적으로 보냅니다.

## 1분 설명

이 프로젝트의 핵심은 "무엇을 말할지"와 "언제 말할지"를 분리한 점입니다. 사용자가 메시지를 보내면 [chatRoutes.ts](../backend/src/routes/chatRoutes.ts)가 먼저 DB에 user message를 저장하고 HTTP `202`를 반환합니다. 그 뒤 [reactivePlanner.ts](../backend/src/runtime/reactivePlanner.ts)가 타이핑 상태와 이어 말할 가능성을 확인하고, [orchestrator.ts](../backend/src/engine/orchestrator.ts)가 `MultiMessagePlan`을 만듭니다. 실제 assistant 메시지는 [messageQueue.ts](../backend/src/runtime/messageQueue.ts)가 delay에 맞춰 저장하고 Socket.IO로 보냅니다. 별도 [scheduler](../scheduler/src/index.ts)는 침묵 시간과 cooldown을 기준으로 선제 발화 가능성을 판단합니다.

## 주요 질문과 답변 기준

### 왜 Socket.IO를 쓰나요?

assistant 메시지가 HTTP 응답으로 바로 오지 않기 때문이다. 사용자의 POST 요청은 accepted로 끝나고, 나중에 timer와 queue를 거친 assistant 메시지가 실시간으로 도착해야 한다. 관련 파일은 [backend/src/runtime/realtime.ts](../backend/src/runtime/realtime.ts)와 [frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx)다.

### 왜 `sendCount: 0`이 필요한가요?

대화에서는 말하지 않는 결정도 중요하다. 사용자가 입력 중이거나 이어 말할 가능성이 높으면 응답을 미루는 것이 더 자연스럽다. 이 판단은 [orchestrator.ts](../backend/src/engine/orchestrator.ts)에 있다.

### 왜 local LLM 서버를 backend와 분리했나요?

Node backend와 Python/llama-cpp 기반 모델 실행 환경이 다르기 때문이다. backend는 [LLMProviderAdapter](../shared/src/index.ts)를 통해 provider를 호출하고, 실제 모델 로드는 [local-llm/server.py](../local-llm/server.py)가 담당한다.

### 가장 중요한 안전장치는 무엇인가요?

사용자가 입력 중일 때 AI가 끼어들지 않도록 하는 장치다. 프론트가 typing을 보내고, backend planner가 확인하며, message queue가 발송 직전에 다시 확인한다. 핵심 파일은 [ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx), [chatRoutes.ts](../backend/src/routes/chatRoutes.ts), [messageQueue.ts](../backend/src/runtime/messageQueue.ts)다.

### 현재 구조의 한계는 무엇인가요?

timer 기반 예약은 메모리에만 있으므로 서버 재시작 시 사라진다. proactive event는 queue 직후 기록되므로 발송 직전 typing으로 skip된 경우 실제 발송과 기록이 어긋날 수 있다. 로컬 LLM 품질은 모델 파일과 실행 환경에 크게 영향을 받는다.

## 자기 점검 질문

- 이 프로젝트가 해결하려는 문제를 "챗봇이 답을 잘한다"가 아니라 "대화 타이밍을 조절한다"는 관점에서 설명할 수 있는가?
- 사용자 메시지가 [ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx)에서 시작해 [messageQueue.ts](../backend/src/runtime/messageQueue.ts)까지 가는 경로를 말할 수 있는가?
- `ConversationSnapshot`과 `MultiMessagePlan`의 필드가 왜 필요한지 설명할 수 있는가?
- local LLM이 죽었을 때 mock으로 숨기지 않는 이유를 말할 수 있는가?
- PostgreSQL store가 있어도 SQLite migration 중심인 현재 실행 경로의 한계를 말할 수 있는가?

## 포트폴리오에서 피해야 할 과장

- 실제 상담 서비스나 의료/응급 대응 시스템이라고 말하지 않는다.
- LLM이 사람의 감정을 정확히 이해한다고 말하지 않는다.
- 모든 대화에서 자연스러운 타이밍을 보장한다고 말하지 않는다.
- 실서비스 규모의 durable queue나 다중 인스턴스 token 공유가 이미 완성됐다고 말하지 않는다.

## 포트폴리오에서 말할 수 있는 것

- event-driven 대화 흐름을 구현했다.
- typing 상태를 정책 입력으로 사용해 interruption을 줄였다.
- reactive 응답과 proactive 발화를 분리했다.
- 공유 타입, store interface, provider adapter로 모듈 경계를 나눴다.
- QR 기반 인증과 관리자 BMP 키 로그인 같은 실험적 인증 흐름을 구현했다.

## 마지막 실습

다음 문장을 자신의 말로 바꿔 말해 본다.

```text
삼마고는 "좋은 답변을 한 번에 생성하는 챗봇"보다 "대화 흐름을 방해하지 않게 운영하는 말동무"에 가깝다.
```

그다음 이 설명을 뒷받침하는 코드 파일 3개를 골라 링크와 함께 적는다.

## 핵심 요약

설명은 코드 근거를 가져야 한다. 강점은 명확히 말하고, 현재 한계는 숨기지 않는 것이 이 프로젝트를 유지보수 가능한 형태로 이해했다는 증거다.

처음으로 돌아가기: [README.md](README.md)
