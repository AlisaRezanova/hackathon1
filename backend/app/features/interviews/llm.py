"""Thin OpenRouter client for the `interviews` feature.

Every public function here returns `None` on *any* failure — missing API
key, network error, timeout, malformed response — and never raises. Callers
(`service.py`) always have a heuristic fallback ready, per HACKATHON.md's
"обязателен heuristic-fallback" rule. Nothing here talks to the DB.
"""

import json
import re

import httpx

from app.config import settings
from app.features.interviews.schemas import ChatTurn

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_TIMEOUT = 15.0

_FOLLOWUP_SYSTEM_PROMPT = (
    "Ты — опытный HR-интервьюер, проводишь exit-интервью с сотрудником, который "
    "увольняется. Тебе дана история вопросов и ответов. Задай ОДИН короткий "
    "уточняющий вопрос на русском языке, который глубже раскроет истинную причину "
    "ухода (не повторяй уже заданные вопросы, не здоровайся, не благодари, не "
    "нумеруй). Если причина уже полностью понятна и уточнять больше нечего, ответь "
    "ровно словом ГОТОВО. Ответь только текстом вопроса или словом ГОТОВО, без "
    "кавычек и пояснений."
)

_ANALYZE_SYSTEM_PROMPT = (
    "Ты — аналитик HR-данных. По транскрипту exit-интервью построй строгий JSON-объект "
    "(без markdown, без пояснений, только один JSON-объект) с полями:\n"
    '- "primary_category": строка — главная причина ухода одной короткой фразой '
    '(например "Компенсация", "Карьерный рост", "Проблемы с руководством", '
    '"Процессы и согласования", "Перегрузка и выгорание" — используй одну из этих, '
    "если подходит по смыслу, иначе предложи свою короткую фразу).\n"
    '- "risk_zone": одно из "low", "medium", "high" — риск токсичности/потери команды.\n'
    '- "categories": список объектов {"category","subtype","quote"} — "quote" ОБЯЗАН быть '
    "дословной цитатой (подстрокой) из транскрипта, ничего не выдумывай.\n"
    '- "best_practices": список объектов {"label","quote"} — что работает хорошо, "quote" '
    "тоже дословная подстрока транскрипта; можно пустой список.\n"
    '- "improvement_suggestions": список из МИНИМУМ 3 реалистичных, конкретных гипотез по '
    "решению главной проблемы (не общих фраз вроде «уволить всех»).\n"
    '- "sentiment_arc": список из 4-6 чисел от -1 до 1 — динамика эмоционального тона '
    "разговора от начала к концу.\n"
    "Не придумывай цитаты, которых нет в тексте."
)


def _post(messages: list[dict], temperature: float) -> str | None:
    if not settings.openrouter_api_key:
        return None
    try:
        response = httpx.post(
            _OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.openrouter_model,
                "messages": messages,
                "temperature": temperature,
            },
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return content.strip() if isinstance(content, str) else None
    except Exception:
        return None


def generate_followup_question(turns: list[ChatTurn]) -> str | None:
    """Ask the LLM for the next follow-up question.

    Returns the question text, `""` when the model explicitly signals it has
    enough (`ГОТОВО`) — a deliberate "stop early" decision, distinct from
    `None`, which means the call failed/was unusable and the caller should
    fall back to a scripted follow-up instead.
    """
    history = "\n".join(f"Вопрос: {t.question}\nОтвет: {t.answer}" for t in turns)
    messages = [
        {"role": "system", "content": _FOLLOWUP_SYSTEM_PROMPT},
        {"role": "user", "content": history},
    ]
    content = _post(messages, temperature=0.5)
    if not content:
        return None
    if "готово" in content.strip().lower():
        return ""
    question = content.strip().strip('"').strip()
    if not question or len(question) > 400:
        return None
    return question


def _extract_json(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"```$", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def generate_llm_passport(transcript: str) -> dict | None:
    """Ask the LLM to build a full problem passport from the transcript.

    Returns a plain dict shaped like `PassportOut` (minus `generated_by`), or
    None on any failure. Quote authenticity against the transcript is
    re-checked by the caller (`service.py`), not here.
    """
    messages = [
        {"role": "system", "content": _ANALYZE_SYSTEM_PROMPT},
        {"role": "user", "content": transcript},
    ]
    content = _post(messages, temperature=0.3)
    if not content:
        return None
    parsed = _extract_json(content)
    if parsed is None:
        return None
    required_keys = {
        "primary_category",
        "risk_zone",
        "categories",
        "best_practices",
        "improvement_suggestions",
        "sentiment_arc",
    }
    if not required_keys.issubset(parsed.keys()):
        return None
    return parsed
