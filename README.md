# Turinglet

사람처럼 먼저 말을 걸 수 있는 AI를 목표로, 답변 내용보다 대화 타이밍 제어를 실험하는 이벤트 기반 AI 대화 프로토타입

## 프로젝트 소개

Turinglet은 일반적인 챗봇처럼 질문이 오면 바로 답하는 구조를 그대로 따르지 않습니다.
이 프로젝트의 중심은 문장 생성 품질 자체보다, 대화 흐름을 어떻게 운영할지에 있습니다.

다루는 질문은 다음과 같습니다.

- 지금 바로 답하는 게 맞는가?
- 잠깐 기다리는 게 더 자연스러운가?
- 먼저 짧게 말을 거는 게 필요한가?
- 반응 메시지는 한 번에 몇 개를 보내는 게 적절한가?

즉, "무엇을 말할지"와 "언제 말할지"를 분리해 다루는 대화 프로토타입입니다.

## 기존 턴제 챗봇과 다른 점

- 일반적인 1문 1답 턴제 챗봇이 아닙니다.
- AI가 상황에 따라 먼저 짧게 말을 걸 수 있습니다.
- 사용자 침묵을 단순 미응답으로 보지 않고, 여러 가능성으로 해석하려고 시도합니다.
- 사용자가 입력 중이면 끼어들지 않도록 설계했습니다.
- 반응 메시지 수가 고정되지 않습니다.
- 봇이 보내는 반응 메시지 개수는 상황에 따라 0개, 1개, 여러 개가 될 수 있습니다.
- 봇 반응은 최대 2개로 제한된 구조가 아니라, 맥락에 따라 여러 개로 나눠 보낼 수 있습니다.

## 주요 기능

- 실시간 채팅 UI
- 사용자 입력 중 상태 반영
- 대화 상태 기반 반응 타이밍 결정
- 침묵 구간 선제 메시지 시도
- 메시지 개수/간격을 포함한 반응 계획 실행
- 로컬 실행 환경 제공
- QR 기반 가입/로그인 및 세션 복원

## 특징

- 메시지 생성과 메시지 발송 시점을 분리해 설계했습니다.
- 사용자가 말을 이어가는 구간에서는 개입을 줄이는 정책을 적용합니다.
- 같은 맥락에서도 즉시 응답, 대기, 선제 발화 중 다른 선택이 가능하도록 구성했습니다.
- 한 번에 긴 메시지 1개를 고정하는 대신, 짧은 메시지를 나눠 전송할 수 있습니다.

## 예시 대화 흐름 또는 동작 방식

### 1) 사용자가 계속 입력하는 경우

1. 입력 중 상태를 감지합니다.
2. 봇은 즉시 응답하지 않고 대기합니다.
3. 입력이 멈춘 뒤에만 반응 계획을 다시 계산합니다.

### 2) 사용자가 짧게 말하고 멈춘 경우

1. 맥락을 보고 즉시 응답이 필요한지 판단합니다.
2. 필요하면 메시지 1개를 보냅니다.
3. 기다림이 더 자연스럽다고 판단하면 메시지를 0개로 유지할 수 있습니다.

### 3) 사용자가 무거운 내용을 남긴 경우

1. 짧은 공감 메시지를 먼저 보냅니다.
2. 필요하면 후속 질문 메시지를 추가합니다.
3. 메시지 수는 상황에 따라 가변이며, 고정된 상한 2개에 맞추지 않습니다.

## 실행 방법

### 1) 의존성 설치

```powershell
npm install
```

### 2) 환경 변수 준비

```powershell
Copy-Item .env.example .env -Force
```

`.env`에서 아래 값을 확인합니다.

```env
LLM_PROVIDER=hf-local
HF_LOCAL_URL=http://127.0.0.1:8010
```

관리자 대시보드를 쓰려면 `.env`에 관리자 ID와 비밀번호의 SHA-256 hex 값을 넣습니다. 실제 비밀번호 원문은 저장하지 않습니다.

```env
ACHRAI_ID=admin
ACHRAI_PW_SHA2_256=비밀번호_sha256_hex값
```

비밀번호 해시는 Node.js로 만들 수 있습니다.

```powershell
node -e "const crypto=require('crypto'); console.log(crypto.createHash('sha256').update('여기에_비밀번호').digest('hex'))"
```

### 3) 로컬 LLM 서버 실행

```powershell
python -m venv .venv-llm
.\.venv-llm\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r local-llm/requirements.txt
```

로컬 LLM 서버는 모델 파일을 자동 다운로드하지 않습니다. 이미 받은 GGUF 모델이 있으면 `.env`에 경로를 지정합니다.

```env
HF_MODEL_PATH=C:/models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf
```

명시적으로 Hugging Face 다운로드를 허용하려면 아래 값을 `.env`에 설정합니다. 기본 cache 위치는 repo 내부 `local-llm/models`입니다.

```env
HF_ALLOW_MODEL_DOWNLOAD=true
HF_MODEL_CACHE_DIR=./local-llm/models
HF_MODEL_REPO=bartowski/Qwen2.5-1.5B-Instruct-GGUF
HF_MODEL_FILE=Qwen2.5-1.5B-Instruct-Q4_K_M.gguf
```

```powershell
npm run llm:server
```

서버가 예외나 모델 문제로 종료될 때 자동 재시작까지 보고 싶으면 PowerShell 스크립트를 사용할 수 있습니다.

```powershell
.\run-llm-server.ps1
```

재시작 횟수를 제한하려면 다음처럼 실행합니다.

```powershell
.\run-llm-server.ps1 -MaxRestarts 5
```

정상 동작 확인

```powershell
curl.exe http://127.0.0.1:8010/health
```

### 4) 앱 실행

```powershell
npm run migrate
npm run dev
```

기본 주소

- frontend: http://localhost:5173
- backend: http://localhost:4000

관리자 대시보드 주소

- PC: http://localhost:5173/achrai/
- 스마트폰: http://PC의_사설IP:5173/achrai/

관리자 화면은 일반 첫 화면에 버튼으로 노출되지 않습니다. `/achrai/`로 직접 접속해 ID와 비밀번호를 입력하면, 브라우저가 비밀번호를 SHA-256으로 바꾼 뒤 서버의 `.env` 값과 대조합니다. 로그인 토큰은 `sessionStorage`에 저장되므로 탭을 닫으면 다시 로그인해야 합니다.

### 5) 스마트폰에서 접속 (같은 Wi-Fi)

이제 별도 `dev:mobile` 없이 `npm run dev`만 실행해도 스마트폰 접속이 가능합니다.

1. PC와 스마트폰을 같은 Wi-Fi에 연결합니다.
2. PC에서 `ipconfig`로 IPv4 주소를 확인합니다. (예: `192.168.0.12`)
3. 스마트폰 브라우저에서 아래 주소로 접속합니다.

```text
http://192.168.0.12:5173
```

참고

- 프론트는 LAN 바인딩(`0.0.0.0`)으로 실행됩니다.
- API와 소켓은 접속한 호스트 IP 기준으로 자동 연결됩니다.
- 접속이 안 되면 Windows 방화벽에서 5173, 4000 포트를 허용해야 합니다.

## 기술 스택

- Frontend: React, TypeScript, Vite, Zustand, socket.io-client
- Backend: Node.js, Express, Socket.IO, TypeScript, Zod
- Database: SQLite(기본), PostgreSQL(선택)
- Local LLM: FastAPI, llama-cpp-python, Hugging Face Hub
- Test: Vitest, Supertest

## 프로젝트 의의 / 한계

### 의의

- 답변 문장 생성 중심 챗봇에서 한 걸음 더 나아가, 대화 타이밍 제어 문제를 구현 대상으로 삼았습니다.
- 입력 상태와 침묵 신호를 반응 정책에 연결해, 단순 턴제 구조의 한계를 실험적으로 줄이고자 했습니다.

### 한계

- 침묵 해석 로직은 아직 규칙 기반 비중이 높아 정교함이 제한적입니다.
- 로컬 모델 성능은 실행 환경(CPU/RAM)에 크게 영향을 받습니다.
- 안전 대응 체계는 연구용 프로토타입 수준이며, 실제 서비스 수준과는 거리가 있습니다.

## 향후 개선점

- 반응 타이밍 정책의 정량 평가 지표 확립
- 침묵 해석 정확도 개선 및 오판 패턴 분석
- 사용자별 대화 속도/스타일 반영 정책 추가
- 개입 빈도와 개입 시점 자동 튜닝
- 실제 운영을 가정한 안전 가이드 보강
