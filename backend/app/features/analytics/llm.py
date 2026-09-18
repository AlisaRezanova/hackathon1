"""OpenRouter-backed cluster summary for the `analytics` drill-down.

Graceful-degradation contract used across the app: an empty API key or any
request failure returns `None` so the caller falls back to a deterministic
heuristic summary/quote selection instead of failing the endpoint (see
CLAUDE.md).
"""

import json

import httpx

from app.config import settings

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_REQUEST_TIMEOUT = 8.0  # keep the drill-down click snappy; fall back past this


class ClusterInsight:
    def __init__(self, summary: str, top_quotes: list[str]) -> None:
        self.summary = summary
        self.top_quotes = top_quotes


class DepartmentInsight:
    def __init__(self, summary: str) -> None:
        self.summary = summary


def _call_openrouter(prompt: str, *, max_tokens: int) -> dict | None:
    """POST a JSON-only prompt to OpenRouter and parse the JSON response.

    Returns `None` on a missing key or any failure (timeout, bad response,
    unparsable output, ...) so callers fall back to a heuristic path.
    """
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
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": max_tokens,
                # This model does hidden chain-of-thought by default, which
                # eats the whole token budget before emitting content
                # (finish_reason "length", content null) and adds ~15-20s
                # of latency. Not needed for a short-summary task.
                "reasoning": {"enabled": False},
            },
            timeout=_REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        if not content or not content.strip():
            return None
        return json.loads(_strip_code_fence(content))
    except (
        httpx.HTTPError,
        KeyError,
        IndexError,
        ValueError,
        TypeError,
        AttributeError,
        json.JSONDecodeError,
    ):
        return None


def summarize_cluster(
    *,
    category: str,
    subtypes: list[str],
    quotes: list[str],
    total_mentions: int,
    interview_count: int,
) -> ClusterInsight | None:
    """Ask the LLM for a short Russian summary + the 3 strongest quotes.

    Kept deliberately small/fast (this blocks opening the drill-down drawer)
    — advice generation is a separate, lazily-fetched call, see
    `advise_on_category`. Returns `None` on a missing key or any failure so
    the router falls back to the heuristic path.
    """
    if not quotes:
        return None

    candidate_quotes = quotes[:10]
    numbered_quotes = "\n".join(f"{i + 1}. {q}" for i, q in enumerate(candidate_quotes))

    prompt = (
        f"Категория причин увольнения: «{category}».\n"
        f"Встречается в {interview_count} интервью, {total_mentions} упоминаний.\n"
        f"Подтипы: {', '.join(subtypes[:6])}.\n"
        f"Цитаты сотрудников:\n{numbered_quotes}\n\n"
        "Ответь СТРОГО в формате JSON без markdown-обёртки:\n"
        '{"summary": "1-2 предложения на русском о сути проблемы кластера и '
        'что она говорит о компании, без вступлений", '
        '"top_quotes": [номера до 3 самых показательных цитат из списка выше, например 2, 5, 1]}'
    )

    payload = _call_openrouter(prompt, max_tokens=300)
    if payload is None:
        return None

    summary_text = str(payload.get("summary", "")).strip()
    if not summary_text:
        return None

    picked_indexes = payload.get("top_quotes", [])
    top_quotes = [
        candidate_quotes[i - 1]
        for i in picked_indexes
        if isinstance(i, int) and 1 <= i <= len(candidate_quotes)
    ][:3]

    return ClusterInsight(summary=summary_text, top_quotes=top_quotes or candidate_quotes[:3])


def advise_on_category(
    *,
    category: str,
    subtypes: list[str],
    quotes: list[str],
) -> list[str] | None:
    """Ask the LLM for >= 3 concrete ways to address a category, on demand
    (the "Получить совет" button) — kept out of `summarize_cluster` so
    opening the drawer itself stays fast.

    Returns `None` on a missing key, any failure, or fewer than 3 usable
    solutions, so the router falls back to the heuristic path.
    """
    if not quotes:
        return None

    prompt = (
        f"Категория причин увольнения: «{category}».\n"
        f"Подтипы: {', '.join(subtypes[:6])}.\n"
        f"Примеры цитат сотрудников:\n"
        + "\n".join(f"- {q}" for q in quotes[:5])
        + "\n\nОтветь СТРОГО в формате JSON без markdown-обёртки:\n"
        '{"solutions": [минимум 3 и максимум 5 конкретных, выполнимых шагов на русском, которые '
        "HR/руководство может предпринять, чтобы решить именно эту проблему]}"
    )

    payload = _call_openrouter(prompt, max_tokens=300)
    if payload is None:
        return None

    solutions = [str(s).strip() for s in payload.get("solutions", []) if str(s).strip()][:5]
    if len(solutions) < 3:
        return None

    return solutions


def summarize_department(
    *,
    department: str,
    high_percent: float,
    total: int,
    high: int,
    top_categories: list[tuple[str, int]],
) -> DepartmentInsight | None:
    """Ask the LLM for a short Russian summary of why a department is (or
    isn't) a risk zone, grounded in its top attrition categories.

    Returns `None` on a missing key or any failure so the router falls back
    to the heuristic path.
    """
    if not top_categories:
        return None

    categories_line = ", ".join(f"{name} ({count})" for name, count in top_categories[:5])

    prompt = (
        f"Отдел «{department}»: {total} интервью с увольняющимися, из них {high} с высоким "
        f"риском ({high_percent}%).\n"
        f"Основные причины ухода в отделе: {categories_line}.\n\n"
        "Ответь СТРОГО в формате JSON без markdown-обёртки:\n"
        '{"summary": "1-2 предложения на русском о том, что происходит в этом отделе и '
        'почему он в такой зоне риска, без вступлений"}'
    )

    payload = _call_openrouter(prompt, max_tokens=200)
    if payload is None:
        return None

    summary_text = str(payload.get("summary", "")).strip()
    if not summary_text:
        return None

    return DepartmentInsight(summary=summary_text)


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.lower().startswith("json"):
            stripped = stripped[4:]
    return stripped.strip()
