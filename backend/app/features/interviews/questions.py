"""Fixed intro questions + keyword-driven fallback follow-ups.

The first 3 questions are always the same (no LLM involved, for demo
reliability). After that, up to 3 follow-ups probe deeper into the primary
complaint — normally via the LLM (see `llm.py`), but if the key is empty or
the call fails, `pick_fallback_followup` below picks a plausible next
question from the answer's keywords so the chat never dead-ends.
"""

DEPARTMENT_OPTIONS = ["Разработка", "Продажи", "Поддержка", "HR", "Маркетинг"]

BASE_QUESTIONS = [
    "В каком отделе вы работали?",
    "Какая у вас была должность?",
    "Опишите своими словами главную причину, по которой вы уходите.",
]

MAX_FOLLOWUPS = 3

# (keywords to match in the last answer, lowercase) -> follow-up question.
# Checked in order; first match wins. Falls back to GENERIC_FOLLOWUPS if none match.
KEYWORD_FOLLOWUPS: list[tuple[tuple[str, ...], str]] = [
    (
        ("денег", "деньги", "зарплат", "оклад", "бонус", "премия", "компенсац"),
        "Насколько сильно расходились ваши ожидания по деньгам с тем, что предлагали здесь, "
        "и обсуждали ли вы это с руководителем напрямую?",
    ),
    (
        ("руководител", "начальник", "менеджер", "микроменеджмент", "лид"),
        "Можете привести конкретный случай, когда действия руководителя сильнее всего "
        "повлияли на ваше решение уйти?",
    ),
    (
        ("рост", "развит", "карьер", "перспектив", "потолок"),
        "Какую конкретно роль или уровень вы хотели бы занять, и что мешало к этому прийти здесь?",
    ),
    (
        ("выгор", "устал", "нагрузк", "перегруз", "переработ"),
        "Как давно вы почувствовали переработку, и пытались ли обсудить нагрузку с "
        "командой или руководителем?",
    ),
    (
        ("процесс", "согласован", "бюрократ", "сроки", "дедлайн"),
        "Какой из процессов отнимал больше всего времени и как вы думаете, почему он "
        "устроен именно так?",
    ),
    (
        ("команда", "коллектив", "коллег", "атмосфер", "климат"),
        "Что именно в отношениях с командой не устраивало сильнее всего в последние месяцы?",
    ),
]

GENERIC_FOLLOWUPS = [
    "Расскажите подробнее — что стало последней каплей в этой ситуации?",
    "Что могло бы измениться, чтобы вы остались, и насколько это было бы реалистично?",
    "Было ли что-то, что вас всё же радовало на этой работе, несмотря на эту проблему?",
]


def pick_fallback_followup(used_questions: set[str], last_answer: str) -> str:
    """Pick the next fallback follow-up, given what's already been asked."""
    answer_lower = last_answer.lower()
    for keywords, question in KEYWORD_FOLLOWUPS:
        if question in used_questions:
            continue
        if any(kw in answer_lower for kw in keywords):
            return question
    for question in GENERIC_FOLLOWUPS:
        if question not in used_questions:
            return question
    # Exhausted — should not normally happen given MAX_FOLLOWUPS <= len(GENERIC_FOLLOWUPS).
    return GENERIC_FOLLOWUPS[-1]
