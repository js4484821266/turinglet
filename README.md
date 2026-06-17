# 삼마고 (Saammaago)

사람처럼 먼저 말을 걸 수 있는 AI를 목표로, 답변 내용보다 대화 타이밍 제어를 실험하는 이벤트 기반 AI 대화 프로토타입

## 이름의 유래

삼마고(Saammaago)는 사람처럼 메시지를 보내고, 사용자가 무슨 말을 하더라도 받아주는 AI를 구상하면서 지은 이름입니다. 무엇이든 편하게 털어놓을 수 있는 공간이라는 점에서 대나무숲을 떠올렸고, 대나무와 관련된 단어를 생각하다가 가장 먼저 `죽마고우`가 떠올랐습니다.

여기서 `죽`을 `죽다`로 보고 그 반의어인 `살다`로 바꾸면서 `산마고우`라는 말이 만들어졌습니다. 이후 발음을 자연스럽게 이어 말하는 과정에서 소리가 동화되어 `삼마고`가 되었고, 이를 영문으로 `Saammaago`라고 표기했습니다. 특별한 고사성어적 의미를 붙였다기보다, 서비스의 성격에서 시작된 연상과 말장난을 거쳐 만들어진 이름입니다.

## 프로젝트 소개

삼마고는 일반적인 챗봇처럼 질문이 오면 바로 답하는 구조를 그대로 따르지 않습니다.
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

운영체제별 주요 명령은 다음과 같습니다.

| 작업 | Windows PowerShell | Debian Bash |
| --- | --- | --- |
| 환경 파일 생성 | `Copy-Item .env.example .env -Force` | `cp .env.example .env` |
| Python 가상환경 활성화 | `.\.venv-llm\Scripts\Activate.ps1` | `source .venv-llm/bin/activate` |
| GGUF 모델 실행 | `npm run dev:llm:windows` | `npm run dev:llm:debian` |

### `.env` 설정

로컬 실행은 저장소 루트의 `.env`를 읽습니다. 처음에는 운영체제에 맞는 명령으로 예시 파일을 복사합니다.

Windows PowerShell:

```powershell
Copy-Item .env.example .env -Force
```

Debian Bash:

```bash
cp .env.example .env
```

#### 로컬 GGUF 모델로 실행

삼마고는 로컬 FastAPI LLM 서버를 필수로 사용합니다. mock 모드는 없으며, 모델을 로드하지 못하면 LLM 서버와 앱 실행이 실패합니다.

```env
HF_LOCAL_URL=http://127.0.0.1:8010
HF_LOCAL_TIMEOUT_MS=30000
HF_LOCAL_STARTUP_WAIT_MS=120000
HF_CONTEXT_SIZE=4096
```

처음에는 작고 비교적 안정적인 instruct GGUF를 받는 편이 낫습니다. 기본 추천 파일은 `Qwen2.5-0.5B-Instruct-Q4_K_M.gguf`입니다. reasoning-distilled 모델이나 `Q2_K`처럼 강하게 압축된 모델은 `<think>` 출력, JSON 형식 실패, 한국어 응답 품질 저하가 더 자주 날 수 있습니다.

모델 파일은 실행 전에 직접 받아 둡니다. 앱 실행 중 자동 다운로드는 하지 않습니다. repo 내부 기본 위치에 받을 때는 다음 중 하나를 사용합니다.

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force local-llm/models
curl.exe -L -o local-llm/models/qwen2.5-0.5b-instruct-q4_k_m.gguf https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf
```

Debian Bash:

```bash
mkdir -p local-llm/models
curl -L -o local-llm/models/qwen2.5-0.5b-instruct-q4_k_m.gguf https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf
```

Hugging Face CLI를 이미 설치했다면 다음 명령도 쓸 수 있습니다.

```bash
huggingface-cli download Qwen/Qwen2.5-0.5B-Instruct-GGUF qwen2.5-0.5b-instruct-q4_k_m.gguf --local-dir local-llm/models --local-dir-use-symlinks False
```

받은 뒤 `.env`에 모델 경로를 지정합니다.

```env
HF_MODEL_PATH=./local-llm/models/qwen2.5-0.5b-instruct-q4_k_m.gguf
```

이미 다른 위치에 받은 GGUF 파일을 사용할 때는 해당 경로를 직접 넣습니다.

```powershell
HF_MODEL_PATH=C:/models/qwen2.5-0.5b-instruct-q4_k_m.gguf
```

```bash
HF_MODEL_PATH=/home/user/models/qwen2.5-0.5b-instruct-q4_k_m.gguf
```

모델 검사는 `HF_MODEL_PATH`만 봅니다. 해당 경로가 유효한 `.gguf` 파일이 아니면 실행은 중단됩니다. 앱 실행 중 자동 다운로드는 하지 않습니다. safetensors는 현재 `llama-cpp-python` 경로에서 직접 로드하지 않으므로 GGUF로 변환해야 합니다.

`HF_CONTEXT_SIZE`는 llama context window입니다. `Requested tokens (...) exceed context window` 오류가 나면 모델 입력이 context보다 크다는 뜻입니다. 현재 서버는 침묵 판단 payload를 짧게 줄이지만, 긴 대화나 큰 prompt를 실험할 때는 `.env`에서 `HF_CONTEXT_SIZE=4096` 이상으로 조정할 수 있습니다.

그 밖의 포트, SQLite 경로, 응답 시간과 선제 발화 설정은 [`.env.example`](.env.example)을 기준으로 조정합니다. `.env`에는 비밀값이나 환경별 경로가 들어갈 수 있으므로 Git에 커밋하지 않습니다.

### Windows 로컬 실행

#### 1) 의존성 설치

```powershell
npm install
```

#### 2) 환경 변수 준비

```powershell
Copy-Item .env.example .env -Force
```

위의 `.env` 설정에서 유효한 GGUF 파일 경로를 준비합니다. 모델 준비가 끝나지 않으면 실행은 실패합니다.

#### 3) 로컬 LLM 서버 실행

```powershell
python -m venv .venv-llm
.\.venv-llm\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r local-llm/requirements.txt
```

로컬 LLM 서버는 `.env`의 `HF_MODEL_PATH`만 사용합니다. 해당 경로에 유효한 GGUF 파일이 없으면 서버가 시작되지 않습니다.

```powershell
npm run llm:server:windows
```

LLM 서버와 앱을 같은 터미널에서 한 번에 실행:

```powershell
npm run dev:llm:windows
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

#### 4) 앱 실행

```powershell
npm run migrate
npm run dev
```

`npm run dev:llm:windows`는 내부에서 migration, LLM 서버, 개발 서버 실행을 함께 처리합니다.

기본 주소

- frontend: http://localhost:5173
- backend: http://localhost:4000

관리자 대시보드 주소

- PC: http://localhost:5173/achrai/
- 스마트폰: http://PC의_사설IP:5173/achrai/

백엔드가 시작될 때 64×64 크기의 1-bit 흑백 가짜 QR BMP 키가 아래 경로에 새로 생성됩니다. 좌상·우상·좌하단의 큰 eye 3개, 흑백이 번갈아 나오는 가로/세로 timing pattern, 우측 하단 안쪽의 작은 alignment eye를 그려 최소한의 QR 형태를 갖추지만 실제 QR 데이터는 인코딩하지 않습니다.

```text
runtime/achrai-admin-key.bmp
```

관리자 화면은 일반 첫 화면에 버튼으로 노출되지 않습니다. `/achrai/`로 직접 접속한 뒤 이번 실행에서 생성된 가짜 QR BMP 파일을 업로드하면 로그인됩니다. 다른 BMP나 이전 실행에서 만든 키는 거부됩니다.

주의 사항

- 앱을 다시 실행하면 BMP 키 파일을 덮어쓰고 기존 키와 관리자 로그인 토큰은 무효가 됩니다.
- `runtime/`은 `.gitignore` 대상입니다. 키 파일을 커밋하거나 외부에 공유하지 마세요.
- 로그인 토큰은 `sessionStorage`에 저장되므로 브라우저 탭을 닫으면 다시 로그인해야 합니다.

#### 5) 스마트폰에서 접속 (같은 Wi-Fi)

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

### Debian 로컬 개발 실행

Debian에서 production 서비스가 아니라 개발 서버로 실행할 때 사용합니다. Node.js 20 이상과 Python 3이 설치되어 있어야 합니다.

```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake libopenblas-dev python3 python3-dev python3-pip python3-venv
npm ci
cp .env.example .env
python3 -m venv .venv-llm
source .venv-llm/bin/activate
python -m pip install --upgrade pip
pip install -r local-llm/requirements.txt
```

`.env`의 모델 설정은 Windows와 같습니다. GGUF 파일을 직접 받은 뒤 그 경로를 `HF_MODEL_PATH`로 지정합니다.

터미널 하나에서 LLM 서버를 실행합니다.

```bash
npm run llm:server:debian
```

다른 터미널에서 앱을 실행합니다.

```bash
npm run migrate
npm run dev
```

준비가 끝난 뒤 한 줄로 실행하려면 다음을 사용합니다.

```bash
npm run dev:llm:debian
```

`dev:llm:debian`은 LLM 서버와 앱을 같은 터미널에서 함께 실행합니다. 모델 파일이 없거나 로드에 실패하면 전체 실행이 중단됩니다.

```bash
curl http://127.0.0.1:8010/health
curl http://127.0.0.1:4000/api/health
```

기본 접속 주소는 Windows와 동일하게 `http://localhost:5173`이며, 관리자 화면은 `http://localhost:5173/achrai/`입니다.

### 클라우드 Debian/Ubuntu 한 줄 실행

클라우드 서버에서는 repo를 clone한 뒤 모델 파일을 직접 넣어야 합니다. 스크립트와 앱은 실행 중 GGUF나 safetensors를 다운로드하지 않습니다. 현재 LLM 서버는 `llama-cpp-python` 기반이므로 바로 로드할 수 있는 형식은 GGUF입니다. safetensors를 쓰려면 별도 변환 또는 다른 추론 서버가 필요합니다.

기본 위치:

```text
local-llm/models/qwen2.5-0.5b-instruct-q4_k_m.gguf
```

다른 경로를 쓰려면 절대 경로로 지정합니다.

```bash
sudo env HF_MODEL_PATH=/absolute/path/to/model.gguf bash deploy/cloud-run.sh
```

기본 위치에 모델을 넣었다면 저장소 루트에서 다음 한 줄로 의존성 설치, `.env` 설정, Python venv 준비, systemd 서비스 등록과 시작까지 처리합니다.

```bash
sudo bash deploy/cloud-run.sh
```

스크립트는 production build를 만든 뒤 `saammaago-llm`, `saammaago-app` systemd 서비스를 등록합니다. 명령이 끝난 뒤 SSH 터미널을 닫아도 계속 실행됩니다. 앱 서비스는 80번 포트에서 프론트, API, Socket.IO를 함께 제공합니다. 스크립트는 Node.js와 Python 자체를 설치하지 않습니다. 클라우드 이미지에 Node.js 20 이상, npm, Python 3, venv, C/C++ build toolchain, systemd가 준비되어 있어야 합니다. 실행 후 접속 주소는 `http://서버_IP`입니다. 방화벽에서는 TCP 80만 외부에 열면 됩니다.

상태 확인:

```bash
sudo systemctl status saammaago-app saammaago-llm
```

로그 확인:

```bash
sudo journalctl -u saammaago-app -f
sudo journalctl -u saammaago-llm -f
```

재시작:

```bash
sudo systemctl restart saammaago-app saammaago-llm
```

실행 종료:

```bash
sudo systemctl stop saammaago-app saammaago-llm
```

부팅 시 자동 시작 해제:

```bash
sudo systemctl disable saammaago-app saammaago-llm
```

로컬 개발 포트인 5173과 4000은 클라우드 production 접속에는 쓰지 않습니다. 클라우드 내부 health check는 다음처럼 확인합니다.

```bash
curl http://127.0.0.1/api/health
```

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
