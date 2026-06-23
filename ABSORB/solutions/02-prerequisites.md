# 02 해설: 선수 지식과 실행 환경

## 1. 기본

`HF_MODEL_PATH`는 Python LLM 서버가 로드할 로컬 GGUF 모델 파일을 지정한다. [../../local-llm/server.py](../../local-llm/server.py)는 이 값이 비었거나 파일이 없거나 GGUF가 아니면 시작하지 않는다.

흔한 오해: npm 의존성을 설치하면 모델도 준비된다고 생각하는 것. 모델 파일은 별도 외부 자원이다.

## 2. 적용

확인 순서 예시:

1. `curl http://127.0.0.1:8010/health`로 LLM 서버 확인
2. `curl http://127.0.0.1:4000/api/health`로 백엔드 확인
3. 백엔드 로그에서 provider 호출 오류 확인
4. 프론트 socket 수신 확인

근거 코드: [../../backend/src/runtime/llmHealth.ts](../../backend/src/runtime/llmHealth.ts), [../../backend/src/adapters/hfLocalProvider.ts](../../backend/src/adapters/hfLocalProvider.ts)

## 3. 변형

`PROACTIVE_MIN_SILENCE_MS`를 너무 작게 줄이면 사용자가 생각 중인 짧은 침묵에도 assistant가 먼저 말할 수 있다. 말동무의 부담 낮은 흐름을 해칠 수 있다.

## 4. 독립 수행

체크리스트 예시:

1. Node.js와 npm 설치 확인
2. `npm install` 또는 기존 `node_modules` 확인
3. `.env`와 `HF_MODEL_PATH` 확인
4. Python venv와 `local-llm/requirements.txt` 설치 확인
5. LLM health와 backend health 순서대로 확인
