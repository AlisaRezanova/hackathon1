"""Keyword-based fallback analysis — used whenever the LLM is unavailable
(no `OPENROUTER_API_KEY`, network error, invalid/unparseable response) or
its output fails quote validation (see `service.py`). Never raises, never
invents quotes: every `quote` is a real sentence copied verbatim from the
transcript, which is how we avoid the "hallucinated problem" anti-pattern
called out in the case brief.

Deliberately simple substring matching (no pymorphy2/NLP dependency) — good
enough for a demo dataset of Russian exit-interview transcripts, and fully
deterministic/inspectable, matching the case's "no black box" spirit.
"""

import re

# category -> [(keyword substring, subtype label), ...]. Categories match
# the ones already present in scripts/seed.py so the analytics dashboard
# aggregates instead of fragmenting into near-duplicate labels.
CATEGORY_KEYWORDS: dict[str, list[tuple[str, str]]] = {
    "Компенсация": [
        ("зарплат", "низкая или замороженная зарплата"),
        ("оклад", "низкая или замороженная зарплата"),
        ("бонус", "проблемы с бонусами/премиями"),
        ("премия", "проблемы с бонусами/премиями"),
        ("вилк", "непрозрачная вилка окладов"),
        ("ставк", "ставка не пересматривается"),
        ("денег", "не устраивает уровень оплаты"),
        ("деньги", "не устраивает уровень оплаты"),
        ("компенсац", "не устраивает уровень оплаты"),
    ],
    "Карьерный рост": [
        ("карьер", "нет карьерного трека"),
        ("рост", "нет карьерного трека"),
        ("развит", "нет пространства для развития"),
        ("перспектив", "не видно перспектив"),
        ("потолок", "карьерный потолок"),
        ("повышен", "нет повышений"),
        ("ротаци", "нет ротации задач"),
    ],
    "Проблемы с руководством": [
        ("руководител", "недовольство действиями руководителя"),
        ("начальник", "недовольство действиями руководителя"),
        ("микроменеджмент", "микроменеджмент"),
        ("критик", "жёсткая или постфактум-критика"),
        ("не слуша", "руководитель не слушает"),
        ("кричит", "агрессивная коммуникация"),
        ("орёт", "агрессивная коммуникация"),
    ],
    "Процессы и согласования": [
        ("согласован", "долгие согласования"),
        ("процесс", "неэффективные процессы"),
        ("бюрократ", "избыточная бюрократия"),
        ("срок", "проблемы со сроками"),
        ("дедлайн", "проблемы со сроками"),
        ("регламент", "жёсткий регламент мешает работе"),
        ("приоритет", "частая смена приоритетов"),
    ],
    "Перегрузка и выгорание": [
        ("выгор", "эмоциональное выгорание"),
        ("устал", "хроническая усталость"),
        ("нагрузк", "чрезмерная нагрузка"),
        ("перегруз", "чрезмерная нагрузка"),
        ("переработ", "регулярные переработки"),
        ("стресс", "высокий уровень стресса"),
    ],
}

# (keyword substring, best-practice label)
POSITIVE_KEYWORDS: list[tuple[str, str]] = [
    ("ментор", "Онбординг с ментором"),
    ("онбординг", "Хороший онбординг"),
    ("поддерж", "Поддержка команды или руководителя"),
    ("помога", "Взаимопомощь в команде"),
    ("автоном", "Автономия в работе"),
    ("довер", "Доверие руководства"),
    ("уважа", "Уважение в команде"),
    ("честно", "Честная обратная связь"),
    ("нрав", "Есть то, что нравится в работе"),
    ("классн", "Позитивная атмосфера"),
    ("коллектив", "Хороший коллектив"),
    ("отлично", "Позитивная атмосфера"),
]

RISK_HIGH_KEYWORDS = [
    "токсичн",
    "унижа",
    "кричит",
    "орёт",
    "оскорб",
    "издевательств",
    "накипело",
    "невыносимо",
    "ненавиж",
]

GENERIC_SUGGESTIONS = [
    "Провести серию 1:1 с командой, чтобы подтвердить масштаб проблемы",
    "Собрать аналогичную обратную связь ещё с 2-3 уволившихся сотрудников",
    "Назначить ответственного за проверку гипотезы в течение месяца",
]

IMPROVEMENT_TEMPLATES: dict[str, list[str]] = {
    "Компенсация": [
        "Провести пересмотр окладов по рынку для затронутых ролей",
        "Опубликовать прозрачную вилку окладов по грейдам",
        "Закладывать бюджет на удержание до получения оффера конкурентов",
    ],
    "Карьерный рост": [
        "Описать карьерный трек и критерии перехода на следующий уровень",
        "Ввести регулярный пересмотр ролей вместе с ростом компании",
        "Согласовывать индивидуальный план развития на каждом ревью",
    ],
    "Проблемы с руководством": [
        "Обучить руководителей давать обратную связь без постфактум-критики",
        "Фиксировать ожидания и критерии до начала работы над задачей",
        "Предусмотреть механизм смены менеджера внутри отдела",
    ],
    "Процессы и согласования": [
        "Сократить цепочку согласования до 1-2 ответственных",
        "Фиксировать приоритеты минимум на двухнедельный период",
        "Прозрачно объяснять команде причины изменения планов",
    ],
    "Перегрузка и выгорание": [
        "Пересмотреть KPI и нормативы нагрузки на одного сотрудника",
        "Расширить команду или перераспределить нагрузку",
        "Ввести регулярные 1:1 вне авральных ситуаций",
    ],
}

# Canonical category set, also used to seed the LLM prompt's "existing
# categories" list (see llm.py) so new chat interviews normalize into the
# same buckets seed.py already uses instead of fragmenting the dashboard.
KNOWN_CATEGORIES = list(CATEGORY_KEYWORDS.keys())

_NEGATIVE_FLAT = [kw for kws in CATEGORY_KEYWORDS.values() for kw, _ in kws] + RISK_HIGH_KEYWORDS
_POSITIVE_FLAT = [kw for kw, _ in POSITIVE_KEYWORDS]

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text: str) -> list[str]:
    """Split a transcript into sentence-ish chunks, cleaned of dialogue dashes."""
    raw = _SENTENCE_SPLIT_RE.split(text.replace("\n", " "))
    sentences = []
    for chunk in raw:
        cleaned = chunk.strip().strip("—-–").strip()
        if cleaned:
            sentences.append(cleaned)
    return sentences


def sentiment_score(text: str) -> float:
    """Naive lexicon-based sentiment in [-1, 1]; 0.0 when no markers found."""
    lowered = text.lower()
    pos = sum(1 for kw in _POSITIVE_FLAT if kw in lowered)
    neg = sum(1 for kw in _NEGATIVE_FLAT if kw in lowered)
    if pos == 0 and neg == 0:
        return 0.0
    raw = (pos - neg) / (pos + neg)
    return max(-1.0, min(1.0, raw))


def heuristic_sentiment_arc(transcript: str, turns: list[dict] | None) -> list[float]:
    if turns:
        return [round(sentiment_score(turn["answer"]), 2) for turn in turns] or [0.0]
    sentences = split_sentences(transcript)
    if not sentences:
        return [0.0]
    return [round(sentiment_score(s), 2) for s in sentences]


def derive_preventability(
    risk_zone: str, categories: list[dict], best_practices: list[dict]
) -> tuple[str, str]:
    """Deterministically estimate "could this exit have been prevented?".

    Not an LLM call — a small function of fields already on the passport, so
    it's available even for old records where nothing extra was persisted
    (see `service.get_interview_detail`) and for the 12 seeded interviews
    that predate this field entirely. The LLM path (`llm.py`) asks the model
    for a richer, context-aware version of the same judgement; this is the
    fallback when that isn't available or trusted.
    """
    total_mentions = sum(int(item.get("mentions", 1) or 1) for item in categories)
    has_best_practices = bool(best_practices)

    if risk_zone == "high" and total_mentions >= 2:
        return (
            "high",
            "Проблема поднималась неоднократно и, судя по транскрипту, осталась без "
            "изменений — уход, вероятно, можно было предотвратить.",
        )
    if risk_zone == "high":
        return (
            "medium",
            "Риск высокий, но явных признаков того, что сотрудник заранее сигнализировал "
            "о проблеме, немного — предотвратимость под вопросом.",
        )
    if risk_zone == "medium" and total_mentions >= 2:
        return (
            "medium",
            "Проблема повторялась несколько раз — своевременное вмешательство могло "
            "изменить решение сотрудника.",
        )
    if risk_zone == "medium":
        return (
            "medium",
            "Системная проблема присутствует, но данных о том, поднимал ли её сотрудник "
            "раньше, недостаточно.",
        )
    if has_best_practices:
        return (
            "low",
            "Причина скорее внешняя или личная (карьерный шаг, оффер) — предотвратить "
            "обычными HR-мерами сложно.",
        )
    return (
        "low",
        "Существенных признаков системной, регулярно поднимаемой проблемы не выявлено.",
    )


def heuristic_analyze(transcript: str, turns: list[dict] | None = None) -> dict:
    """Build a full "problem passport" dict (matches `PassportOut` shape)."""
    sentences = split_sentences(transcript)

    # (category, subtype) -> {"quote": str, "mentions": int}
    found: dict[tuple[str, str], dict] = {}
    positive_hits: list[tuple[str, str]] = []

    for sentence in sentences:
        lowered = sentence.lower()
        for category, keywords in CATEGORY_KEYWORDS.items():
            for kw, subtype in keywords:
                if kw in lowered:
                    key = (category, subtype)
                    if key not in found:
                        found[key] = {"quote": sentence, "mentions": 1}
                    else:
                        found[key]["mentions"] += 1
        for kw, label in POSITIVE_KEYWORDS:
            if kw in lowered:
                positive_hits.append((label, sentence))

    categories = [
        {
            "category": category,
            "subtype": subtype,
            "quote": data["quote"],
            "mentions": data["mentions"],
        }
        for (category, subtype), data in found.items()
    ]
    categories.sort(key=lambda item: item["mentions"], reverse=True)

    totals: dict[str, int] = {}
    for item in categories:
        totals[item["category"]] = totals.get(item["category"], 0) + item["mentions"]

    if totals:
        primary_category = max(totals, key=lambda cat: totals[cat])
    else:
        primary_category = "Другое"
        categories = [
            {
                "category": "Другое",
                "subtype": "не удалось классифицировать по ключевым словам",
                "quote": sentences[0] if sentences else transcript[:200],
                "mentions": 1,
            }
        ]

    seen_labels: set[str] = set()
    best_practices = []
    for label, quote in positive_hits:
        if label in seen_labels:
            continue
        seen_labels.add(label)
        best_practices.append({"label": label, "quote": quote})
        if len(best_practices) >= 3:
            break

    complaint_sentence_count = len({s for cats in found.values() for s in [cats["quote"]]})
    has_high_risk = any(kw in transcript.lower() for kw in RISK_HIGH_KEYWORDS)
    if has_high_risk or (complaint_sentence_count >= 3 and not best_practices):
        risk_zone = "high"
    elif complaint_sentence_count >= 1:
        risk_zone = "medium"
    else:
        risk_zone = "low"

    improvement_suggestions = list(IMPROVEMENT_TEMPLATES.get(primary_category, GENERIC_SUGGESTIONS))
    while len(improvement_suggestions) < 3:
        for suggestion in GENERIC_SUGGESTIONS:
            if suggestion not in improvement_suggestions:
                improvement_suggestions.append(suggestion)
                break
        else:
            break

    sentiment_arc = heuristic_sentiment_arc(transcript, turns)
    preventability, preventability_reason = derive_preventability(
        risk_zone, categories, best_practices
    )

    return {
        "primary_category": primary_category,
        "risk_zone": risk_zone,
        "categories": categories,
        "best_practices": best_practices,
        "improvement_suggestions": improvement_suggestions[:5],
        "sentiment_arc": sentiment_arc,
        "preventability": preventability,
        "preventability_reason": preventability_reason,
        "generated_by": "heuristic",
    }
