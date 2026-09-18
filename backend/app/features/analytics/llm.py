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


def summarize_cluster(
    *,
    category: str,
    subtypes: list[str],
    quotes: list[str],
    total_mentions: int,
    interview_count: int,
) -> ClusterInsight | None:
    """Ask the LLM for a short Russian summary + the 3 strongest quotes.

    Returns `None` on a missing key or any failure (timeout, bad response,
    unparsable output, ...) so the router falls back to the heuristic path.
    """
    if not settings.openrouter_api_key or not quotes:
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
                "max_tokens": 300,
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

        payload = json.loads(_strip_code_fence(content))
        summary_text = str(payload["summary"]).strip()
        if not summary_text:
            return None

        picked_indexes = payload.get("top_quotes", [])
        top_quotes = [
            candidate_quotes[i - 1]
            for i in picked_indexes
            if isinstance(i, int) and 1 <= i <= len(candidate_quotes)
        ][:3]

        return ClusterInsight(summary=summary_text, top_quotes=top_quotes or candidate_quotes[:3])
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


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.lower().startswith("json"):
            stripped = stripped[4:]
    return stripped.strip()
