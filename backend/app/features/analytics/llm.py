"""OpenRouter-backed cluster summary for the `analytics` drill-down.

Graceful-degradation contract used across the app: an empty API key or any
request failure returns `None` so the caller falls back to a deterministic
heuristic summary instead of failing the endpoint (see CLAUDE.md).
"""

import httpx

from app.config import settings

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def summarize_cluster(
    *,
    category: str,
    subtypes: list[str],
    quotes: list[str],
    total_mentions: int,
    interview_count: int,
) -> str | None:
    """Ask the LLM for a short Russian summary of one problem cluster.

    Returns `None` on a missing key or any failure (timeout, bad response,
    ...) so the router can fall back to the heuristic summary.
    """
    if not settings.openrouter_api_key:
        return None

    prompt = (
        f"Категория причин увольнения: «{category}».\n"
        f"Встречается в {interview_count} интервью, {total_mentions} упоминаний.\n"
        f"Подтипы: {', '.join(subtypes[:6])}.\n"
        "Цитаты сотрудников:\n" + "\n".join(f"- {q}" for q in quotes[:6]) + "\n\n"
        "Напиши короткое саммари (1-2 предложения) для HR-дашборда на русском "
        "языке: в чём суть проблемы этого кластера и что она говорит о "
        "компании. Без вступлений и заголовков, только суть."
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
                "max_tokens": 200,
            },
            timeout=10.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()
        return content or None
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError):
        return None
