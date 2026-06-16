from __future__ import annotations

import json
import os
import logging
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI
from huggingface_hub import hf_hub_download
from llama_cpp import Llama
from pydantic import BaseModel
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[1]


def _load_repo_env() -> None:
    """Load simple KEY=VALUE pairs from the repo .env without extra dependencies."""
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or key in os.environ:
            continue
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        os.environ[key] = value


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "y", "on"}


def _repo_relative_path(raw_path: str) -> Path:
    candidate = Path(raw_path).expanduser()
    if candidate.is_absolute():
        return candidate.resolve()
    return (REPO_ROOT / candidate).resolve()


_load_repo_env()


TaskType = Literal["single_message", "multi_plan", "summary", "silence_meaning"]


class GenerateRequest(BaseModel):
    task: TaskType
    payload: Dict[str, Any]


class GenerateResponse(BaseModel):
    ok: bool
    result: Any | None = None
    error: Optional[str] = None


app = FastAPI(title="Saammaago Local LLM")


# Prefer an explicit local GGUF path. Downloading is opt-in so server startup does
# not write model files to a user cache or the repo without a clear setting.
MODEL_PATH = os.getenv("HF_MODEL_PATH", "").strip()
MODEL_REPO = os.getenv("HF_MODEL_REPO", "Qwen/Qwen2.5-0.5B-Instruct-GGUF")
MODEL_FILE = os.getenv("HF_MODEL_FILE", "qwen2.5-0.5b-instruct-q4_k_m.gguf")
ALLOW_MODEL_DOWNLOAD = _truthy(os.getenv("HF_ALLOW_MODEL_DOWNLOAD"))
MODEL_CACHE_DIR = _repo_relative_path(os.getenv("HF_MODEL_CACHE_DIR", "./local-llm/models"))
HOST = os.getenv("HF_LOCAL_HOST", "127.0.0.1")
PORT = int(os.getenv("HF_LOCAL_PORT", "8010"))


def _resolve_model_path() -> Path:
    if MODEL_PATH:
        local_path = _repo_relative_path(MODEL_PATH)
        if not local_path.exists():
            raise FileNotFoundError(
                f"HF_MODEL_PATH points to a missing file: {local_path}. "
                "Set it to an existing local GGUF model path."
            )
        return local_path

    if not ALLOW_MODEL_DOWNLOAD:
        raise RuntimeError(
            "No local model file configured. Set HF_MODEL_PATH to an existing GGUF file. "
            "To explicitly allow a Hugging Face download, set HF_ALLOW_MODEL_DOWNLOAD=true; "
            f"the cache directory will be {MODEL_CACHE_DIR}."
        )

    MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        return Path(
            hf_hub_download(
                repo_id=MODEL_REPO,
                filename=MODEL_FILE,
                cache_dir=str(MODEL_CACHE_DIR),
            )
        )
    except Exception as exc:
        raise RuntimeError(
            f"Failed to download model '{MODEL_FILE}' from '{MODEL_REPO}'. "
            "Check your internet connection, set HF_MODEL_PATH to a local file, "
            "or adjust HF_MODEL_REPO / HF_MODEL_FILE."
        ) from exc


_model_path = _resolve_model_path()
llm = Llama(
    model_path=str(_model_path),
    n_ctx=2048,
    n_threads=max(1, (os.cpu_count() or 4) // 2),
    verbose=False,
)


def _chat(system: str, user: str, max_tokens: int = 200, temperature: float = 0.7) -> str:
    """Generate a response using the chat-completion interface."""
    try:
        output = llm.create_chat_completion(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=0.9,
            repeat_penalty=1.05,
        )
        result = output["choices"][0]["message"]["content"].strip()  # type: ignore[index]
        return result
    except Exception as e:
        logger.error(f"Chat generation failed: {e}", exc_info=True)
        raise


def _safe_chat_with_fallback(system: str, user: str, max_tokens: int = 200, temperature: float = 0.7) -> str:
    """Chat with error recovery to prevent server crash."""
    try:
        return _chat(system, user, max_tokens, temperature)
    except Exception as e:
        logger.warning(f"Chat failed, returning generic response: {e}")
        return "지금은 잠시 생각해야 할 것 같아요. 다시 한 번 말씀해줄 수 있을까요?"


def _extract_json(text: str) -> Dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model output")
    return json.loads(text[start : end + 1])


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "model": str(_model_path)}


@app.post("/v1/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    try:
        if req.task == "single_message":
            user_text = (req.payload.get("userText") or "").strip()[:300]
            system = (
                "너는 따뜻하고 자연스러운 상담 도우미다. "
                "1~2문장만. 공감 + 구체적 질문. 뻔한 말/교훈 금지."
            )
            result = _safe_chat_with_fallback(system, user_text, max_tokens=100, temperature=0.75)
            return GenerateResponse(ok=True, result=result)

        if req.task == "summary":
            messages = req.payload.get("recentMessages", [])
            latest_user = ""
            for m in reversed(messages):
                if m.get("role") == "user":
                    latest_user = m.get("content", "")[:200]
                    break
            system = (
                "감정 강도(0~10)와 한 줄 요약을 JSON으로만 출력하라. "
                '형식: {"emotionalIntensity": N, "summary": "..."}'
            )
            raw = _safe_chat_with_fallback(system, latest_user, max_tokens=80, temperature=0.1)
            data = _extract_json(raw)
            return GenerateResponse(ok=True, result=data)

        if req.task == "silence_meaning":
            snapshot = req.payload.get("snapshot", {})
            if bool(snapshot.get("userTyping", False)):
                return GenerateResponse(ok=True, result="typing")
            system = (
                "다음 상황에서 침묵 의미를 하나 고르라: crying, organizing_thoughts, "
                "emotionally_overwhelmed, away, typing\n정답 하나만 출력."
            )
            raw = _safe_chat_with_fallback(system, json.dumps(req.payload, ensure_ascii=False), max_tokens=16, temperature=0.0).strip()
            allowed = {"crying", "organizing_thoughts", "emotionally_overwhelmed", "away", "typing"}
            value = raw.split()[0].strip().lower()
            if value not in allowed:
                value = "organizing_thoughts"
            return GenerateResponse(ok=True, result=value)

        # multi_plan
        user_text = (req.payload.get("userText") or "").strip()[:300]
        system = (
            "JSON만 출력. 사용자가 말을 이어갈 것 같으면 sendCount=0, 아니면 1~2개 짧은 메시지.\n"
            "공감+구체적 질문, 뻔한 말 금지.\n"
            '형식: {"sendCount":1,"reason":"...","nextState":"reflective_pause",'
            '"messages":[{"content":"...","delayMs":600,"presenceBeforeSend":"typing"}]}'
        )
        raw = _safe_chat_with_fallback(system, user_text, max_tokens=250, temperature=0.6)
        data = _extract_json(raw)

        msgs = data.get("messages", []) if isinstance(data.get("messages", []), list) else []
        safe_msgs: List[Dict[str, Any]] = []
        for item in msgs[:2]:
            if not isinstance(item, dict):
                continue
            content = str(item.get("content", "")).strip()
            if not content:
                continue
            delay = int(item.get("delayMs", 600))
            presence = item.get("presenceBeforeSend", "typing")
            if presence not in {"typing", "thinking", "organizing", "waiting"}:
                presence = "typing"
            safe_msgs.append(
                {
                    "content": content,
                    "delayMs": max(0, min(delay, 5000)),
                    "presenceBeforeSend": presence,
                }
            )

        if not safe_msgs:
            data = {
                "sendCount": 1,
                "reason": "fallback",
                "nextState": "reflective_pause",
                "messages": [
                    {
                        "content": "지금 얘기해준 부분이 꽤 버겁게 들려요. 제일 먼저 걸리는 장면 하나만 같이 볼까요?",
                        "delayMs": 600,
                        "presenceBeforeSend": "typing",
                    }
                ],
            }
        else:
            data["messages"] = safe_msgs
            data["sendCount"] = len(safe_msgs)
            data["nextState"] = data.get("nextState", "reflective_pause")
            data["reason"] = str(data.get("reason", "llm_plan"))

        return GenerateResponse(ok=True, result=data)

    except Exception as exc:
        logger.error(f"Generate request failed: {exc}", exc_info=True)
        return GenerateResponse(ok=False, error=str(exc))


def main() -> int:
    logger.info(f"Starting LLM server on {HOST}:{PORT}")
    logger.info(f"Model path: {_model_path}")
    uvicorn.run(app, host=HOST, port=PORT, reload=False, log_level="info")
    return 0


if __name__ == "__main__":
    main()
