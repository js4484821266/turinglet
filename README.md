# Turinglet: Event-Driven Rapport Counseling Chatbot (Portfolio Prototype)

Electron + React + TypeScript + Node.js + SQLite(PostgreSQL 교체 가능) 기반의 로컬 실행형 심리상담 대화 프로토타입입니다.
핵심은 답변 문구 자체보다, 사람처럼 대화의 타이밍과 흐름을 운영하는 정책 엔진입니다.

## 1. 프로젝트 목적

이 프로젝트는 다음 문제를 해결하기 위해 설계되었습니다.

- 기존 턴제 챗봇은 사용자 입력 1개에 응답 1개를 강제함
- 실제 정서 대화는 비동기적이며, 침묵/타이핑/감정 과부하를 포함함
- 사용자 상태에 따라 "지금은 기다려야 하는지"가 응답 내용만큼 중요함

따라서 Turinglet은 아래를 목표로 합니다.

- strict turn-taking이 아닌 event-driven 대화
- 관계 형성(rapport) 중심 운영
- 과잉 개입보다 공감/대기/저자극 확인 메시지 우선
- 로컬 시연 가능한 안정적 구조 + LLM provider 확장성

## 2. 차별점 (Portfolio Highlight)

### 2.1 턴제 챗봇이 아닌 운영형 챗봇

- 사용자 1개 메시지 후 AI가 0개/1개/다중 메시지를 보낼 수 있음
- 다중 메시지는 최대 2개 제한 없음
- 긴/무거운 맥락에서는 사람처럼 짧은 문장을 여러 개로 나눠 연속 전송 가능(필요 시 10개+)

### 2.2 "지금 답하지 않는 것"도 정책 결정

- 사용자가 계속 말할 가능성이 높으면 응답 보류
- 사용자가 타이핑 중이면 끼어들지 않음
- 침묵은 단순 미응답이 아니라 다중 해석(울음, 정리 중, 과부하, 자리 비움, 타이핑)

### 2.3 대화 저장 철학: append-only 이벤트 로그

- 메시지는 수정/삭제보다 append 이벤트 중심
- 대화 추적성/감사성/분석 용이성 확보

### 2.4 QR 기반 무비밀번호 인증

- 이메일/비밀번호 없이 긴 랜덤 토큰 + QR로 가입/로그인
- 복구코드 선택 기능 제공
- 토큰/복구코드는 해시 저장

## 3. 구현 범위 (요구사항 매핑)

### 3.1 구조 분리

- frontend
- backend
- shared
- database
- prompt-engineering
- scheduler

### 3.2 UI/UX

- 메신저 스타일 말풍선
- 상태 표시: 생각 중 / 정리 중 / 잠시 기다리는 중 / 타이핑 중
- Enter 전송, Shift+Enter 줄바꿈
- 관리자 대시보드(사용자/세션/메시지/선제 이벤트 조회)

### 3.3 대화 엔진

- 메시지 생성기와 오케스트레이터 분리
- 오케스트레이터가 메시지 개수/간격/보류 여부 결정
- "계속 말할 것 같음" 감지 시 응답 보류
- 감정 고강도 맥락에서 과잉 질문 억제

### 3.4 선제 메시지 스케줄러

의사결정 입력:

- 최근 대화 맥락
- 마지막 사용자 발화 시점
- 마지막 AI 발화 시점
- 최근 감정 강도
- 쿨다운
- 타이핑 여부

### 3.5 인증

- 가입: 고엔트로피 public token 생성 후 QR 발급
- 로그인: QR payload 검증 + 사용자 식별
- 복구: recovery code로 토큰 재발급

### 3.6 DB

마이그레이션 파일: `database/migrations/001_init.sql`

테이블:

- users
- identity_tokens
- sessions
- messages
- proactive_events
- emotional_state_snapshots
- safety_flags
- typing_presence
- device_logins

### 3.7 Mock/Adapter

- 실제 LLM 없이 mock provider로 로컬 시연 가능
- LLM provider adapter 계약 유지

인터페이스:

- generateMessage()
- generateMultiMessagePlan()
- summarizeConversationState()
- detectUserSilenceMeaning()

## 4. 기술 아키텍처

### 4.1 레이어

- frontend: 사용자 인터랙션, 실시간 렌더링, 관리자 뷰
- backend: 인증/API/대화 운영/소켓 브로드캐스트
- scheduler: 선제 아웃리치 정책
- shared: 타입 및 계약 인터페이스
- database: 마이그레이션/로컬 DB 유틸

### 4.2 대화 파이프라인

1. 사용자 메시지 수신
2. 감정 강도 요약
3. 오케스트레이터가 전송 계획 결정
4. 계획된 메시지를 지연 간격에 따라 전송
5. 타이핑/침묵/쿨다운 이벤트를 반영해 후속 행동 조정

### 4.3 왜 event-driven인가

턴제 모델은 “문장 생성”에는 강하지만 “대화 흐름 운영”에는 약합니다.
본 프로젝트는 생성(model)과 운영(policy)을 분리해 운영 품질을 먼저 확보합니다.

## 5. 실행 방법 (로컬)

1. 설치

```bash
npm install
```

2. 환경변수 복사

```bash
copy .env.example .env
```

3. DB 마이그레이션

```bash
npm run migrate
```

4. 실행

```bash
npm run dev
```

5. 테스트

```bash
npm run test
```

참고:

- `predev`에서 shared/scheduler/database 빌드 + migrate 자동 수행
- backend: `http://localhost:4000`
- frontend(vite): `http://localhost:5173`

## 6. 관리자 대시보드 사용법

상단 탭에서 `관리자` 선택 시 다음 데이터를 확인할 수 있습니다.

- 사용자 목록
- 세션 목록(메시지 수, 마지막 활동 시각)
- 세션별 메시지 로그
- 최근 proactive 이벤트 사유

디버깅 포인트:

- "왜 기존 대화가 안 보이는지" 세션 재사용 여부 확인
- "왜 전송 실패가 뜨는지" 상태코드/이벤트 흐름 역추적

## 7. 패키지 선택 이유

- Electron: 로컬 데스크톱 데모 즉시 가능
- React + Vite: 빠른 반복 개발
- Socket.IO: 비동기 실시간 메시지 반영
- better-sqlite3: 로컬 단일 파일 DB, 빠른 프로토타이핑
- pg: PostgreSQL 확장 대비
- qrcode: QR 발급
- @zxing/browser: 카메라/이미지 QR 스캔
- Zustand: 경량 상태 관리
- Vitest + Supertest: 정책/인증 테스트

## 8. 보안/안정성 반영 사항

- 긴 랜덤 토큰(고엔트로피)
- 토큰/복구코드 해시 저장
- QR payload 포맷 검증
- 요청 rate limit
- typing heartbeat는 rate limit에서 제외해 사용자 전송에 영향 최소화
- append-only 로그 기반 추적성 확보

## 9. 현재 한계

- mock provider는 여전히 규칙 기반이며 임상적 추론을 수행하지 않음
- 고위험 상황 대응은 최소 경고 수준(전문 위기 프로토콜 미완성)
- 관리자 대시보드는 인증 없는 내부 디버깅 뷰(실서비스에선 RBAC 필요)
- 대화 품질 평가(정량 메트릭) 자동화 미흡

## 10. 보완 로드맵

### 단기

- 관리자 대시보드에 전송 실패 상태코드 집계 추가
- 세션 병합/분기 관리
- 메시지 전송 상태(전송중/확정/실패) 시각화

### 중기

- OpenAI/Anthropic adapter 실연동
- 안전 정책 분리(위험도 분류 + 대응 시나리오)
- Postgres 마이그레이션 자동화 및 인덱스 최적화

### 장기

- 정책 엔진 A/B 실험
- 정서 대화 품질 지표(응답 타이밍 만족도, 재개입 피로도 등) 도입
- 데이터 암호화 고도화(at-rest + key management)

## 11. 포트폴리오 관점에서 강조할 포인트

이 프로젝트는 "챗봇 답변 생성"보다 아래 엔지니어링 역량을 보여줍니다.

- 대화 운영 정책 설계 능력
- 이벤트 기반 상태머신 사고
- 인증/저장/실시간 UI를 아우르는 풀스택 통합 능력
- 확장 가능한 adapter 아키텍처 설계
- 디버깅 가능한 관리자 관측(Observability) 관점

---

실서비스 목적이 아닌 프로토타입이며, 민감한 심리/의료 상담의 대체 수단이 아닙니다.
