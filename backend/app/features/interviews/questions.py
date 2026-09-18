"""Fixed intro questions + keyword-driven fallback follow-ups.

The first 3 questions are always the same (no LLM involved, for demo
reliability). After that, up to 3 follow-ups probe deeper into the primary
complaint — normally via the LLM (see `llm.py`), but if the key is empty or
the call fails, `pick_fallback_followup` below picks a plausible next
question so the chat never dead-ends.

Follow-ups are evidence-seeking, not just "tell me more": each matched
category has an ordered ladder of up to 3 questions that target a different
missing fact about the complaint — WHAT actually happened, whether the
employee took ACTION (raised it with someone), and how the company/manager
REACTED. That's what turns "AI just chatted" into "AI actually dug up the
real cause" (see KOSTYA_PLAN.md's "Заметка: качество уточняющих вопросов").
"""

from app.features.interviews.schemas import ChatTurn

DEPARTMENT_OPTIONS = ["Разработка", "Продажи", "Поддержка", "HR", "Маркетинг"]

BASE_QUESTIONS = [
    "В каком отделе вы работали?",
    "Какая у вас была должность?",
    "Опишите своими словами главную причину, по которой вы уходите.",
]

MAX_FOLLOWUPS = 3

# (keywords to match anywhere in the answers so far) -> ordered ladder of
# follow-ups, each targeting a different evidence slot: WHAT happened
# concretely, whether the employee took ACTION, how the company/manager
# REACTED. Checked in order; first category match wins, then its ladder is
# walked top-to-bottom skipping already-asked questions.
KEYWORD_FOLLOWUPS: list[tuple[tuple[str, ...], list[str]]] = [
    (
        ("денег", "деньги", "зарплат", "оклад", "бонус", "премия", "компенсац"),
        [
            "Насколько сильно расходились ваши ожидания по деньгам с тем, что "
            "предлагали здесь — можете назвать разницу?",
            "Вы напрямую обсуждали пересмотр оплаты с руководителем? Что именно вы "
            "просили и что вам ответили?",
            "Что компания сделала после этого разговора — пересмотрела оплату, "
            "объяснила отказ, или вопрос просто повис в воздухе?",
        ],
    ),
    (
        ("руководител", "начальник", "менеджер", "микроменеджмент", "лид"),
        [
            "Можете привести конкретный случай, когда действия руководителя сильнее "
            "всего повлияли на ваше решение уйти?",
            "Вы говорили об этом с самим руководителем или с HR напрямую? Что именно вы сказали?",
            "Что изменилось после этого разговора — руководитель скорректировал "
            "поведение, или всё осталось как было?",
        ],
    ),
    (
        ("рост", "развит", "карьер", "перспектив", "потолок", "повышен"),
        [
            "Какую конкретно роль или уровень вы хотели бы занять, и что мешало к "
            "этому прийти здесь?",
            "Вы озвучивали эти карьерные ожидания руководителю или на ревью? Как давно это было?",
            "Что вам ответили — предложили конкретный план роста, отложили разговор, "
            "или не предложили ничего?",
        ],
    ),
    (
        ("выгор", "устал", "нагрузк", "перегруз", "переработ", "стресс"),
        [
            "Как давно вы почувствовали, что нагрузка стала чрезмерной, и что с тех "
            "пор изменилось?",
            "Вы пытались обсудить нагрузку с командой или руководителем? Что именно вы просили?",
            "Что сделала компания в ответ — добавила ресурсы, пересмотрела нагрузку, "
            "или ситуация осталась прежней?",
        ],
    ),
    (
        ("процесс", "согласован", "бюрократ", "сроки", "дедлайн", "приоритет"),
        [
            "Какой из процессов отнимал больше всего времени и как вы думаете, "
            "почему он устроен именно так?",
            "Вы предлагали изменить этот процесс? Кому именно и в какой форме?",
            "Что произошло после того, как вы это предложили — процесс изменили, "
            "объяснили, почему нельзя, или предложение не рассмотрели вовсе?",
        ],
    ),
]

# Used when no category keyword matched, or the matched category's ladder is
# exhausted — still evidence-seeking (WHAT / ACTION / REACTION), just generic.
GENERIC_FOLLOWUPS = [
    "Что конкретно произошло в последний раз, когда эта проблема стала особенно заметна?",
    "Вы пытались как-то решить это сами или обсудить с кем-то? Что именно вы делали?",
    "Как на это отреагировали — руководитель или компания что-то предприняли, или "
    "ситуация осталась без изменений?",
]


def pick_fallback_followup(turns: list[ChatTurn]) -> str:
    """Pick the next fallback follow-up from the full history so far.

    Matches keywords against ALL answers (not just the latest) since the
    core complaint is often named in the 3rd base question while later
    follow-up answers drift onto related details. Walks the matched
    category's evidence ladder in order (WHAT -> ACTION -> REACTION),
    skipping anything already asked, so three follow-ups actually progress
    instead of repeating "tell me more" three times.
    """
    used_questions = {t.question for t in turns}
    combined_answers = " ".join(t.answer for t in turns).lower()

    for keywords, ladder in KEYWORD_FOLLOWUPS:
        if not any(kw in combined_answers for kw in keywords):
            continue
        for question in ladder:
            if question not in used_questions:
                return question

    for question in GENERIC_FOLLOWUPS:
        if question not in used_questions:
            return question
    # Exhausted — should not normally happen given MAX_FOLLOWUPS == 3.
    return GENERIC_FOLLOWUPS[-1]
