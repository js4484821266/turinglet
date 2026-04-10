# Turinglet Prototype

Electron + React + TypeScript + Node.js + SQLite 기반의 로컬 시연용 심리상담 AI 챗봇 프로토타입입니다.
핵심은 답변 문장 품질보다, 사람처럼 대화 흐름을 운영하는 이벤트 기반 오케스트레이션입니다.

## 목적
- 일반적인 1턴(질문 1개-응답 1개) 챗봇이 아닌 비동기적 인간형 대화 흐름을 시연
- 사용자 침묵을 단순 미응답으로 처리하지 않고, 공감/대기/짧은 확인 중심 정책 적용
- 로컬에서 실제로 실행 가능해야 하며, 추후 LLM provider 교체가 쉬운 구조

## 일반 턴제 챗봇과의 차이
- 사용자 1개 입력 후 AI가 메시지 2개 이상 보낼 수 있음
- 사용자 입력 없이도 조건 충족 시 AI 선제 메시지 가능
- 사용자가 타이핑 중이면 AI가 끼어들지 않음
- 침묵이 길어도 즉시 재촉하지 않고 공감 후 대기 정책 사용

## 아키텍처

### 폴더 구조
- frontend: Electron + React 메신저 UI
- backend: API, QR 인증, 오케스트레이터, 이벤트 저장, 소켓
- shared: 공용 타입, LLM adapter interface, 상태 타입
- database: 마이그레이션/시드
- prompt-engineering: 프롬프트 설계 파일
- scheduler: 선제 메시지 정책 엔진

### 엔진 분리
- 메시지 생성기: backend/src/engine/messageGenerator.ts
- 대화 운영자(Orchestrator): backend/src/engine/orchestrator.ts
- 운영자는 0/1/2개 메시지 전송 여부와 간격을 결정

### 상태/정책
공용 상태 예시:
- idle
- waiting_after_empathy
- user_typing
- reflective_pause
- proactive_checkin_candidate
- cooldown_after_outreach
- high_emotional_load

선제 메시지 판단 입력:
- 최근 대화 맥락(요약/감정 강도)
- 마지막 사용자/AI 발화 시점
- 타이핑 여부
- 쿨다운

## DB 설계 (Append-only 중심)
마이그레이션: database/migrations/001_init.sql

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

메시지는 update/delete 대신 messages append 이벤트로 누적 저장하도록 설계했습니다.

## QR 가입/로그인
- 가입 시 256비트 이상 랜덤 토큰(기본 48 bytes)을 생성
- QR payload에 토큰을 담아 생성/다운로드
- 로그인 시 QR payload를 서버에서 포맷 검증 후 식별
- 포맷 위조/오류 시 실패 처리
- 복구코드(선택) 발급 가능 + 복구 endpoint 제공

## 실행 방법 (로컬)
1. 루트에서 설치

```bash
npm install
```

2. 환경변수 파일 생성

```bash
copy .env.example .env
```

3. DB 마이그레이션

```bash
npm run migrate
```

4. (선택) 시드

```bash
npm run seed
```

5. 실행

```bash
npm run dev
```

실행 후 Electron 창이 열리고, backend는 http://localhost:4000 에서 동작합니다.

## 테스트

```bash
npm run test
```

포함 테스트:
- 사용자 입력 없을 때 선제 메시지 조건 테스트
- 사용자 타이핑 중 AI가 끼어들지 않는지 테스트
- 공감 후 대기 정책 테스트
- QR 로그인 성공/실패 테스트

## Mock 모드 / 실제 LLM 연동
기본값은 mock provider입니다.
- 설정: .env의 MOCK_PROVIDER=true
- 파일: backend/src/adapters/mockProvider.ts

실제 API 연동 시:
- backend/src/adapters/index.ts 의 PlaceholderExternalProvider를 OpenAI/Anthropic adapter로 교체
- 반드시 shared/src/index.ts 의 LLMProviderAdapter 계약 유지

필수 인터페이스:
- generateMessage()
- generateMultiMessagePlan()
- summarizeConversationState()
- detectUserSilenceMeaning()

## 패키지 선택 이유
- Electron: 로컬 데스크톱 시연 용이
- React + Vite: 빠른 UI 반복 개발
- Socket.IO: 상태/메시지 실시간 반영
- better-sqlite3: 로컬 단일 파일 DB, 빠른 프로토타이핑
- pg: PostgreSQL 어댑터 확장 대비
- qrcode: QR 생성
- @zxing/browser: 카메라/이미지 QR 스캔
- Zustand: 최소 상태 관리
- Vitest + Supertest: 정책/인증 테스트

## 보안 기본 반영
- 긴 랜덤 ID(고엔트로피)
- 토큰/복구코드 해시 저장
- QR 포맷 검증 및 위조/오류 처리
- 간단한 IP 기반 rate limit
- 이벤트 로그 중심 저장(원본 대화 보존)

## 알려진 한계 / TODO
- safety_flags 자동 분류 로직은 현재 최소 수준
- 실제 위기 대응 가이드/안전 프로토콜 강화 필요
- Postgres 마이그레이션 자동화는 별도 스크립트로 확장 필요
- 로컬 데이터 암호화(at-rest) 고도화 필요
