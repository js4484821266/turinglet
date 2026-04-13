from __future__ import annotations

import json
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline


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
import os
MODEL_NAME = os.getenv("HF_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")

text_gen = pipeline(
    "text-generation",
    model=MODEL_NAME,
    device_map="auto",
)


def _gen(prompt: str, max_new_tokens: int = 220, temperature: float = 0.7) -> str:
    out = text_gen(
        prompt,
        max_new_tokens=max_new_tokens,
        do_sample=True,
        temperature=temperature,
        top_p=0.92,
        repetition_penalty=1.08,
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
            user_text = (req.payload.get("userText") or "").strip()
            prompt = (
                "너는 한국어 상담 대화 도우미다. 공감적이고 자연스럽게 1~2문장으로 답해라. "
                "원칙 설명/교훈체를 피하고, 사용자의 실제 표현을 반영해라.\n"
                f"의도: {intent}\n"
                f"사용자: {user_text}\n"
                "답변:"
            )
            return GenerateResponse(ok=True, result=_gen(prompt, max_new_tokens=120, temperature=0.8))

        if req.task == "summary":
            messages = req.payload.get("recentMessages", [])
            latest_user = ""
            for m in reversed(messages):
                if m.get("role") == "user":
                    latest_user = m.get("content", "")
                    break
            prompt = (
                "다음 사용자 발화의 감정 강도(0~10 정수)와 한 줄 요약을 JSON으로만 출력하라.\n"
                f"발화: {latest_user}\n"
                '형식: {"emotionalIntensity": 0, "summary": "..."}'
            )
            data = _extract_json(_gen(prompt, max_new_tokens=100, temperature=0.2))
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
        user_text = (req.payload.get("userText") or "").strip()
        prompt = (
            "너는 한국어 상담 대화 도우미다. 사용자 입력에 대해 반응 계획을 JSON으로만 출력해라.\n"
            "규칙:\n"
            "- 아직 사용자가 말을 이어가는 느낌이면 sendCount=0, messages=[]\n"
            "- 아니면 1~2개의 짧은 메시지로 공감+질문 중심\n"
            "- 문장은 교훈체/원칙설명체를 피하고 사용자의 표현을 반영\n"
            f"사용자 입력: {user_text}\n"
            "형식:\n"
            '{"sendCount":1,"reason":"...","nextState":"reflective_pause","messages":[{"content":"...","delayMs":600,"presenceBeforeSend":"typing"}]}'
        )
        data = _extract_json(_gen(prompt, max_new_tokens=260, temperature=0.65))

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
