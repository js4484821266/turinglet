# 11. 자기 말로 설명하기

## 학습 목표

- 프로젝트 전체를 과장 없이 설명한다.
- 주요 기술 선택의 이유와 한계를 함께 말한다.
- AI 또는 외부 도움을 받은 부분과 본인이 이해한 부분을 구분한다.

## 앞 문서와의 연결

[10-reimplementation.md](10-reimplementation.md)에서 핵심 기능을 다시 구현하는 사고 연습을 했습니다. 마지막 문서에서는 이 프로젝트를 자신의 말로 설명하고 점검합니다.

## 먼저 생각해 볼 질문

- "제가 만든 AI 상담 서비스입니다"라고 말하면 어떤 점이 부정확할까요?
- 면접관이 "이게 일반 챗봇과 뭐가 다른가요?"라고 물으면 어떤 코드 위치를 근거로 답할 수 있을까요?
- "AI가 다 해줬다"와 "AI 도움을 받아 구현했지만 구조를 설명할 수 있다"는 어떻게 다를까요?

## 3분 설명 틀

다음 순서로 말해보세요.

1. 삼마고는 정리되지 않은 말도 편하게 남길 수 있는 AI 말동무 프로토타입입니다.
2. 일반 1문 1답 챗봇과 달리, 답변 내용뿐 아니라 언제 말할지와 몇 개로 나눠 말할지를 다룹니다.
3. 프론트는 React와 Socket.IO로 채팅 UI를 보여주고, 백엔드는 Express에서 API와 반응 계획을 처리합니다.
4. 사용자 메시지는 먼저 저장되고 HTTP는 `202`로 끝나며, 실제 assistant 메시지는 reactive planner와 queue를 거쳐 나중에 전송됩니다.
5. 침묵이 길어지면 scheduler가 최소 침묵 시간과 cooldown을 확인한 뒤 제한적으로 선제 발화를 시도합니다.
6. 로컬 LLM은 FastAPI 서버로 분리되어 있고, 백엔드는 provider adapter를 통해 메시지 계획, 요약, 침묵 의미 추론을 요청합니다.
7. 한계는 로컬 모델 품질과 규칙 기반 침묵 해석의 제한이며, 상담/의료/응급 서비스를 대체하지 않습니다.

## 코드 근거 붙이기

설명에는 파일 근거가 있어야 합니다.

| 설명 | 근거 파일 |
| --- | --- |
| 백엔드가 LLM health를 기다린다 | [../backend/src/server.ts](../backend/src/server.ts) |
| 앱 조립은 한 곳에서 한다 | [../backend/src/app.ts](../backend/src/app.ts) |
| 사용자 메시지는 202로 수락한다 | [../backend/src/routes/chatRoutes.ts](../backend/src/routes/chatRoutes.ts) |
| typing 중이면 끼어들지 않는다 | [../backend/src/engine/orchestrator.ts](../backend/src/engine/orchestrator.ts) |
| 침묵 선제 발화는 cooldown을 본다 | [../scheduler/src/index.ts](../scheduler/src/index.ts) |
| 메시지는 delay 후 queue에서 전송된다 | [../backend/src/runtime/messageQueue.ts](../backend/src/runtime/messageQueue.ts) |
| 화면은 socket 이벤트를 받는다 | [../frontend/src/components/ChatPanel.tsx](../frontend/src/components/ChatPanel.tsx) |
| 로컬 모델은 GGUF 파일을 요구한다 | [../local-llm/server.py](../local-llm/server.py) |

## 면접 질문 연습

1. 왜 assistant 응답을 HTTP 요청 안에서 바로 반환하지 않았나요?
2. 사용자가 typing 중인지를 서버까지 보내는 이유는 무엇인가요?
3. `sendCount: 0`은 어떤 의미인가요?
4. proactive 메시지가 너무 자주 나가지 않게 하는 장치는 무엇인가요?
5. LLM이 잘못된 JSON을 반환하면 어떻게 처리하나요?
6. SQLite와 PostgreSQL을 둘 다 고려한 이유는 무엇인가요?
7. 로컬 LLM 서버를 Node.js 안에 직접 넣지 않은 이유는 무엇인가요?
8. 이 프로젝트가 상담 서비스가 아니라고 말해야 하는 이유는 무엇인가요?
9. 본인이 직접 이해하고 설명할 수 있는 부분과 도움을 받은 부분은 어떻게 구분하나요?

## 최종 점검

아래 항목을 스스로 확인하세요.

- 프로젝트 목적을 자기 말로 설명할 수 있다.
- 전체 실행 흐름을 파일 위치와 함께 설명할 수 있다.
- reactive와 proactive의 차이를 예시로 설명할 수 있다.
- `ConversationSnapshot`과 `MultiMessagePlan`의 역할을 설명할 수 있다.
- 사용자 메시지 하나가 DB, planner, queue, socket, UI를 거치는 경로를 말할 수 있다.
- LLM 서버, 모델 파일, 환경 변수 문제를 코드 문제와 분리할 수 있다.
- 작은 정책 변경 계획을 세우고 필요한 테스트를 고를 수 있다.
- 핵심 판단 함수 하나를 원본 없이 다시 작성할 수 있다.
- 프로젝트의 한계와 안전상 주의점을 과장 없이 말할 수 있다.
- 자신의 기여와 AI 도움의 범위를 정직하게 설명할 수 있다.

## 실습

1. README를 보지 않고 프로젝트를 5문장으로 요약합니다.
2. `POST /api/chat/messages` 이후 흐름을 종이에 그립니다.
3. 선제 발화 조건을 코드 위치 2개 이상과 함께 설명합니다.
4. "이 프로젝트에서 가장 위험하게 오해될 수 있는 점"을 하나 고르고 방지 문구를 작성합니다.
5. 작은 기능 변경 하나를 정하고, 수정 파일, 테스트, 문서 갱신 여부를 계획합니다.

## 이해 확인 퀴즈

1. 기본: 삼마고를 "상담 서비스"라고 설명하면 안 되는 이유를 말하세요.
2. 적용: 면접관이 "답장이 왜 늦게 오나요?"라고 물으면 어떤 구조를 설명해야 하나요?
3. 변형: 로컬 LLM 없이도 설명 가능한 부분과 설명하면 안 되는 실행 결과를 구분하세요.
4. 독립 수행: 프로젝트 전체를 3분 발표 스크립트로 작성하고, 각 주장 옆에 근거 파일을 붙이세요.

해설: [solutions/11-explain-it-yourself.md](solutions/11-explain-it-yourself.md)

## 핵심 요약

이 교재의 끝은 "다 읽었다"가 아니라 "근거 파일을 짚으며 설명하고, 작은 변경을 안전하게 계획할 수 있다"입니다.

처음으로 돌아가기: [README.md](README.md)
