from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Literal, Optional

# Windows local run workaround for duplicated OpenMP runtimes loaded by ML deps.
# Allows startup for local prototype environments where torch/numpy stacks collide.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline
import uvicorn


TaskType = Literal["single_message", "multi_plan", "summary", "silence_meaning"]


class GenerateRequest(BaseModel):
    task: TaskType
    payload: Dict[str, Any]


class GenerateResponse(BaseModel):
    ok: bool
    result: Any | None = None
    error: Optional[str] = None


app = FastAPI(title="Turinglet Local HF LLM")


# CPU-only baseline model. Change via HF_MODEL env if needed.
# Small model for local experimentation (quality is limited but non-rule-based).
MODEL_NAME = os.getenv("HF_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")
HOST = os.getenv("HF_LOCAL_HOST", "127.0.0.1")
PORT = int(os.getenv("HF_LOCAL_PORT", "8010"))

text_gen = pipeline(
    "text-generation",
    model=MODEL_NAME,
)


def _gen(prompt: str, max_new_tokens: int = 100, temperature: float = 0.7) -> str:
    """Generate text with reduced tokens for faster inference."""
    out = text_gen(
        prompt,
        max_new_tokens=max_new_tokens,
        do_sample=True,
        temperature=temperature,
        top_p=0.9,
        repetition_penalty=1.05,
    )
    if not out:
        return ""
    text = out[0].get("generated_text", "")
    if text.startswith(prompt):
        text = text[len(prompt):]
    return text.strip()


def _extract_json(text: str) -> Dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model output")
    return json.loads(text[start : end + 1])


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "model": MODEL_NAME}


@app.post("/v1/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    try:
        if req.task == "single_message":
            intent = req.payload.get("intent", "reflection")
            user_text = (req.payload.get("userText") or "").strip()[:200]  # Truncate for speed
            prompt = (
                "너는 따뜻하고 자연스러운 상담 도우미다.\n"
                "1~2문장만. 공감 + 구체적 질문. 뻔한 말/교훈 금지.\n\n"
                f"사용자: {user_text}\n대답:"
            )
            return GenerateResponse(ok=True, result=_gen(prompt, max_new_tokens=80, temperature=0.75))

        if req.task == "summary":
            messages = req.payload.get("recentMessages", [])
            latest_user = ""
            for m in reversed(messages):
                if m.get("role") == "user":
                    latest_user = m.get("content", "")[:150]  # Truncate
                    break
            prompt = (
                "감정 강도(0~10)와 한 줄만. JSON: {\"emotionalIntensity\": N, \"summary\": \"...\"}\n"
                f"발화: {latest_user}\n{{"
            )
            data = _extract_json("{" + _gen(prompt, max_new_tokens=60, temperature=0.1))
            return GenerateResponse(ok=True, result=data)

        if req.task == "silence_meaning":
            snapshot = req.payload.get("snapshot", {})
            user_typing = bool(snapshot.get("userTyping", False))
            if user_typing:
                return GenerateResponse(ok=True, result="typing")

            prompt = (
                "다음 상황에서 침묵 의미를 하나 고르라: crying, organizing_thoughts, emotionally_overwhelmed, away, typing\n"
                f"상황: {json.dumps(req.payload, ensure_ascii=False)}\n"
                "정답 하나만 출력:"
            )
            raw = _gen(prompt, max_new_tokens=16, temperature=0.0).strip()
            allowed = {
                "crying",
                "organizing_thoughts",
                "emotionally_overwhelmed",
                "away",
                "typing",
            }
            value = raw.split()[0].strip().lower()
            if value not in allowed:
                value = "organizing_thoughts"
            return GenerateResponse(ok=True, result=value)

        # multi_plan
        user_text =  - optimize for speed and clarity
        user_text = (req.payload.get("userText") or "").strip()[:250]  # Truncate for speed
        prompt = (
            "JSON만 출력. 사용자가 말을 이어갈 것 같으면 sendCount=0. 아니면 1~2개 짧은 메시지.\n"
            "공감+구체적질문. 뻔한 말 금지.\n"
            f"사용자: {user_text}\n"
            '출력: {"sendCount":'
        )
        data = _extract_json("{\"sendCount\":" + _gen(prompt, max_new_tokens=180, temperature=0.6
        # Lightweight guardrails
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
            data["reason"] = str(data.get("reason", "hf_local_plan"))

        return GenerateResponse(ok=True, result=data)

    except Exception as exc:
        return GenerateResponse(ok=False, error=str(exc))


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, reload=False)
