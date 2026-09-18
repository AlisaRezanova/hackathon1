"""Thin OpenRouter client for the `interviews` feature.

Every public function here returns `None` on *any* failure — missing API
key, network error, timeout, malformed response — and never raises. Callers
(`service.py`) always have a heuristic fallback ready, per HACKATHON.md's
"обязателен heuristic-fallback" rule. Nothing here talks to the DB.
"""

import json
import re
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError

import httpx

from app.config import settings
from app.features.interviews.schemas import ChatTurn

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Reasoning-capable OpenRouter models can trickle keep-alive bytes while
# "thinking", which resets httpx's own read-timeout clock and lets a slow
# call run far past the timeout we pass it (observed hangs of 40s+ with a
# nominal 15s httpx timeout). A thread + `future.result(timeout=...)` is a
# real wall-clock deadline regardless of what the network layer does; the
# demo's case brief also caps end-to-end processing at "< 1 minute", so
# these two budgets (chat follow-up, full analysis) must be hard limits.
_FOLLOWUP_TIMEOUT = 12.0
_ANALYZE_TIMEOUT = 20.0
_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="openrouter-call")

_FOLLOWUP_SYSTEM_PROMPT = (
    "Ты — опытный HR-интервьюер, проводишь exit-интервью с сотрудником, который "
    "увольняется. Тебе дана история вопросов и ответов. Твоя цель — не просто "
    "продолжить разговор, а добыть недостающие факты (evidence) о главной "
    "проблеме. У тебя есть 5 слотов, которые в идеале нужно закрыть:\n"
    "1. WHAT — что конкретно произошло (факт, а не общая жалоба).\n"
    "2. WHY — почему это стало причиной ухода именно для этого человека.\n"
    "3. DURATION — как долго это происходило / как давно началось.\n"
    "4. ACTION — пытался ли сотрудник сам решить проблему или поднять её перед кем-то.\n"
    "5. REACTION — что сделала компания или руководитель в ответ на это.\n\n"
    "За 3 уточняющих вопроса все 5 слотов не закрыть — сам выбери САМЫЙ "
    "информативный из ещё не закрытых слотов по истории диалога и задай ОДИН "
    "короткий конкретный вопрос на русском языке под него. Плохой пример (слишком "
    'общий): "Расскажите подробнее". Хороший пример (конкретный, целится в WHAT): '
    '"Что конкретно в действиях руководителя сильнее всего повлияло на ваше '
    'решение уйти?" — а следующим вопросом, если ACTION и REACTION ещё не '
    'известны: "Вы обсуждали эту проблему с ним или с HR? Если да, что изменилось '
    'после разговора?"\n'
    "Не повторяй уже заданные вопросы, не здоровайся, не благодари, не нумеруй "
    "слоты в ответе. Если все ключевые слоты уже закрыты и уточнять больше "
    "нечего, ответь ровно словом ГОТОВО. Ответь только текстом вопроса или "
    "словом ГОТОВО, без кавычек и пояснений."
)

_ANALYZE_SYSTEM_PROMPT_TEMPLATE = (
    "Ты — аналитик HR-данных. По транскрипту exit-интервью построй строгий JSON-объект "
    "(без markdown, без пояснений, только один JSON-объект) с полями:\n"
    '- "primary_category": строка — главная причина ухода одной короткой фразой.\n'
    "  В компании уже используются категории: {known_categories}.\n"
    "  Сначала проверь, подходит ли семантически одна из существующих категорий "
    "(например, сигнал «начальник контролировал каждый мой шаг» — это "
    "«Проблемы с руководством», а не новая категория «Микроменеджмент»). "
    "Выбери существующую категорию, если она подходит по смыслу. Создавай "
    "новую короткую категорию только если среди существующих действительно нет "
    "подходящей.\n"
    '- "risk_zone": одно из "low", "medium", "high" — риск токсичности/потери команды.\n'
    '- "categories": список объектов {{"category","subtype","quote"}} — "category" '
    "выбирается по тому же правилу нормализации, что и primary_category; "
    '"quote" ОБЯЗАН быть дословной цитатой (подстрокой) из транскрипта, ничего не '
    "выдумывай.\n"
    '- "best_practices": список объектов {{"label","quote"}} — что работает хорошо, '
    '"quote" тоже дословная подстрока транскрипта; можно пустой список.\n'
    '- "improvement_suggestions": список из МИНИМУМ 3 реалистичных, конкретных гипотез '
    "по решению главной проблемы (не общих фраз вроде «уволить всех»).\n"
    '- "sentiment_arc": список из 4-6 чисел от -1 до 1 — динамика эмоционального тона '
    "разговора от начала к концу.\n"
    '- "preventability": одно из "low", "medium", "high" — можно ли было предотвратить '
    "этот уход силами компании (не просто «умеренная зарплата», а был ли реальный шанс "
    "вмешаться: сотрудник поднимал проблему заранее, руководство знало и не "
    "среагировало и т.п.).\n"
    '- "preventability_reason": одно предложение — почему именно такая оценка, со '
    "ссылкой на факты из транскрипта (например, «сотрудник неоднократно сообщал о "
    "проблеме, но действий не последовало»).\n"
    "Не придумывай цитаты, которых нет в тексте."
)


def _call_openrouter(messages: list[dict], temperature: float) -> str | None:
    """The actual blocking HTTP call — only ever run through `_post` below,
    which enforces the real wall-clock deadline."""
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
            "max_tokens": 1200,
        },
        timeout=httpx.Timeout(connect=8.0, read=60.0, write=8.0, pool=8.0),
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return content.strip() if isinstance(content, str) else None


def _post(messages: list[dict], temperature: float, timeout_seconds: float) -> str | None:
    if not settings.openrouter_api_key:
        return None
    try:
        future = _EXECUTOR.submit(_call_openrouter, messages, temperature)
        return future.result(timeout=timeout_seconds)
    except FutureTimeoutError:
        # Hard deadline hit — the call may still be running in the background
        # thread (harmless, discarded once it finishes); the caller falls
        # back to the heuristic so the user never waits past our budget.
        return None
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
    content = _post(messages, temperature=0.5, timeout_seconds=_FOLLOWUP_TIMEOUT)
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


def generate_llm_passport(transcript: str, known_categories: list[str]) -> dict | None:
    """Ask the LLM to build a full problem passport from the transcript.

    `known_categories` (already-used labels from the DB, see `service.py`) is
    injected into the prompt so the model normalizes into an existing bucket
    instead of minting near-duplicate categories — otherwise the analytics
    dashboard's "% by category" fragments instead of aggregating.

    Returns a plain dict shaped like `PassportOut` (minus `generated_by`), or
    None on any failure. Quote authenticity against the transcript is
    re-checked by the caller (`service.py`), not here.
    """
    system_prompt = _ANALYZE_SYSTEM_PROMPT_TEMPLATE.format(
        known_categories=", ".join(f'"{c}"' for c in known_categories)
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": transcript},
    ]
    content = _post(messages, temperature=0.3, timeout_seconds=_ANALYZE_TIMEOUT)
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
        "preventability",
        "preventability_reason",
    }
    if not required_keys.issubset(parsed.keys()):
        return None
    return parsed
