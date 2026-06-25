"""?? GGUF ??? ???? task API? ????.

??? repo? .env? /v1/generate JSON?? ??? task? result envelope?.
HF_MODEL_PATH? ??? ??? ?? ??? ?? ??? ????.
?? Llama ????? native ??? ???? ?? ?? ??? ?????.
"""

from __future__ import annotations

import json
import os
import logging
from threading import Lock
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI
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


def _repo_relative_path(raw_path: str) -> Path:
    candidate = Path(raw_path).expanduser()
    if candidate.is_absolute():
        return candidate.resolve()
    return (REPO_ROOT / candidate).resolve()


def _int_env(name: str, fallback: int, minimum: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return fallback
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer, got: {raw}") from exc
    if value < minimum:
        raise RuntimeError(f"{name} must be at least {minimum}, got: {value}")
    return value


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


# A local GGUF model is required. Startup fails if the configured file is missing
# or cannot be loaded by llama-cpp-python.
MODEL_PATH = os.getenv("HF_MODEL_PATH", "").strip()
HOST = os.getenv("HF_LOCAL_HOST", "127.0.0.1")
PORT = int(os.getenv("HF_LOCAL_PORT", "8010"))
CONTEXT_SIZE = _int_env("HF_CONTEXT_SIZE", 4096, 512)


def _validate_local_model_file(local_path: Path) -> None:
    if not local_path.exists():
        raise FileNotFoundError(f"model file does not exist: {local_path}")
    if not local_path.is_file():
        raise ValueError(f"model path is not a file: {local_path}")
    if local_path.stat().st_size <= 0:
        raise ValueError(f"model file is empty: {local_path}")
    if local_path.suffix.lower() != ".gguf":
        raise ValueError(
            f"model file must be a GGUF file for llama-cpp-python: {local_path}"
        )


def _resolve_model_path() -> Path:
    if not MODEL_PATH:
        raise RuntimeError(
            "No local model file configured. Set HF_MODEL_PATH to an existing GGUF file. "
            "This server does not download model files during startup."
        )

    local_path = _repo_relative_path(MODEL_PATH)
    try:
        _validate_local_model_file(local_path)
        return local_path
    except Exception as exc:
        raise RuntimeError(
            f"HF_MODEL_PATH is not a valid local GGUF model: {local_path}. "
            "Download a GGUF model manually and set HF_MODEL_PATH to that file."
        ) from exc


_model_path = _resolve_model_path()
try:
    llm = Llama(
        model_path=str(_model_path),
        n_ctx=CONTEXT_SIZE,
        n_threads=max(1, (os.cpu_count() or 4) // 2),
        verbose=False,
    )
except Exception as exc:
    raise RuntimeError(f"Failed to load GGUF model with llama-cpp-python: {_model_path}") from exc

LLM_LOCK = Lock()


def _chat(system: str, user: str, max_tokens: int = 200, temperature: float = 0.7) -> str:
    """Generate a response using the chat-completion interface."""
    try:
        # llama-cpp-python shares native state inside the Llama object. FastAPI
        # can run sync handlers concurrently, so serialize generation calls to
        # avoid ggml asserts from overlapping requests.
        with LLM_LOCK:
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


def _extract_json(text: str) -> Dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model output")
    return json.loads(text[start : end + 1])


def _try_extract_json(text: str) -> Dict[str, Any] | None:
    try:
        return _extract_json(text)
    except Exception:
        return None


def _short_text(value: Any, limit: int) -> str:
    text = str(value or "").replace("\r", " ").replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "..."


def _compact_silence_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    snapshot = payload.get("snapshot", {})
    if not isinstance(snapshot, dict):
        snapshot = {}

    recent_messages = payload.get("recentMessages", [])
    if not isinstance(recent_messages, list):
        recent_messages = []

    compact_messages: List[Dict[str, str]] = []
    for item in recent_messages[-5:]:
        if not isinstance(item, dict):
            continue
        compact_messages.append(
            {
                "role": _short_text(item.get("role"), 16),
                "content": _short_text(item.get("content"), 220),
            }
        )

    return {
        "snapshot": {
            "userTyping": bool(snapshot.get("userTyping", False)),
            "state": _short_text(snapshot.get("state"), 48),
            "recentEmotionalIntensity": snapshot.get("recentEmotionalIntensity", 0),
            "lastUserMessageAt": snapshot.get("lastUserMessageAt"),
            "lastAssistantMessageAt": snapshot.get("lastAssistantMessageAt"),
            "lastMessageAt": snapshot.get("lastMessageAt"),
        },
        "recentMessages": compact_messages,
    }


def _compact_prompt_json(value: Dict[str, Any], limit: int = 1800) -> str:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "..."


def _summary_from_model_text(raw: str, latest_user: str) -> Dict[str, Any]:
    data = _try_extract_json(raw)
    if data:
        intensity = data.get("emotionalIntensity", 5)
        try:
            intensity = int(intensity)
        except (TypeError, ValueError):
            intensity = 5
        summary = _short_text(data.get("summary") or raw or latest_user, 120)
        return {"emotionalIntensity": max(0, min(10, intensity)), "summary": summary}

    text = _short_text(raw, 120)
    if not text:
        raise ValueError("Model returned neither JSON nor text for summary")
    return {"emotionalIntensity": 5, "summary": text}


def _plan_from_model_text(raw: str, user_text: str) -> Dict[str, Any]:
    data = _try_extract_json(raw)
    if data:
        return data

    content = _short_text(raw, 500)
    if not content:
        raise ValueError("Model returned neither JSON nor text for multi_plan")
    return {
        "sendCount": 1,
        "reason": "llm_text_plan",
        "nextState": "reflective_pause",
        "messages": [
            {
                "content": content,
                "delayMs": 600,
                "presenceBeforeSend": "typing",
            }
        ],
    }


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "model": str(_model_path), "contextSize": CONTEXT_SIZE}


@app.post("/v1/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    try:
        if req.task == "single_message":
            user_text = (req.payload.get("userText") or "").strip()[:300]
            system = (
                "너는 따뜻하고 자연스러운 상담 도우미다. "
                "1~2문장만. 공감 + 구체적 질문. 뻔한 말/교훈 금지."
            )
            result = _chat(system, user_text, max_tokens=100, temperature=0.75)
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
            raw = _chat(system, latest_user, max_tokens=80, temperature=0.1)
            data = _summary_from_model_text(raw, latest_user)
            return GenerateResponse(ok=True, result=data)

        if req.task == "silence_meaning":
            snapshot = req.payload.get("snapshot", {})
            if isinstance(snapshot, dict) and bool(snapshot.get("userTyping", False)):
                return GenerateResponse(ok=True, result="typing")
            system = (
                "다음 상황에서 침묵 의미를 하나 고르라: crying, organizing_thoughts, "
                "emotionally_overwhelmed, away, typing\n정답 하나만 출력."
            )
            compact_payload = _compact_silence_payload(req.payload)
            raw = _chat(system, _compact_prompt_json(compact_payload), max_tokens=16, temperature=0.0).strip()
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
        raw = _chat(system, user_text, max_tokens=250, temperature=0.6)
        data = _plan_from_model_text(raw, user_text)

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
            raise ValueError("Model returned a multi_plan without valid messages")

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
