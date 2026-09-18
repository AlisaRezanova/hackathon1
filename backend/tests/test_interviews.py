"""Tests for the `interviews` feature: chat state machine + heuristic
fallback analysis. Deliberately avoids the DB-backed endpoints
(`/analyze`, `GET /api/interviews`) so `pytest` runs standalone without a
live Postgres, same as `test_health.py`. The LLM key is monkeypatched to
empty so these tests never hit the network — deterministic and free.
"""

from fastapi.testclient import TestClient

from app.config import settings
from app.features.interviews.heuristic import heuristic_analyze
from app.features.interviews.questions import BASE_QUESTIONS, MAX_FOLLOWUPS, pick_fallback_followup
from app.features.interviews.schemas import ChatTurn
from app.features.interviews.service import _transcript_from_turns
from app.main import app

client = TestClient(app)

SAMPLE_TRANSCRIPT = (
    "— Уходишь? — Да, перехожу к конкурентам. — Почему? — Знаешь, сама работа "
    "классная, но убивает вот это: мы полгода обсуждаем ТЗ, а потом переделываем "
    "за неделю. Процесс согласования — это ад. — А что было хорошо? — Зато очень "
    "нравится, как устроен онбординг, ментор помогал реально."
)


def _no_llm(monkeypatch) -> None:
    monkeypatch.setattr(settings, "openrouter_api_key", "")


def test_chat_first_step_asks_department_question() -> None:
    response = client.post("/api/interviews/chat", json={"turns": []})
    assert response.status_code == 200
    body = response.json()
    assert body["step"] == 1
    assert body["kind"] == "base"
    assert body["done"] is False
    assert body["question"] == BASE_QUESTIONS[0]
    assert body["department_options"]


def test_chat_walks_through_all_base_questions() -> None:
    turns: list[dict] = []
    for expected_question in BASE_QUESTIONS:
        response = client.post("/api/interviews/chat", json={"turns": turns})
        body = response.json()
        assert body["kind"] == "base"
        assert body["question"] == expected_question
        turns.append({"question": body["question"], "answer": "Ответ на вопрос"})


def test_chat_followup_falls_back_without_llm_key(monkeypatch) -> None:
    _no_llm(monkeypatch)
    turns = [
        {"question": BASE_QUESTIONS[0], "answer": "Разработка"},
        {"question": BASE_QUESTIONS[1], "answer": "Backend-разработчик"},
        {"question": BASE_QUESTIONS[2], "answer": "Мало платят, зарплату не поднимали"},
    ]
    response = client.post("/api/interviews/chat", json={"turns": turns})
    body = response.json()
    assert body["kind"] == "followup"
    assert body["generated_by"] == "heuristic"
    assert body["done"] is False
    assert body["question"]


def test_chat_stops_after_max_followups(monkeypatch) -> None:
    _no_llm(monkeypatch)
    turns = [
        {"question": BASE_QUESTIONS[0], "answer": "Разработка"},
        {"question": BASE_QUESTIONS[1], "answer": "Backend-разработчик"},
        {"question": BASE_QUESTIONS[2], "answer": "Мало платят"},
    ]
    for _ in range(MAX_FOLLOWUPS):
        response = client.post("/api/interviews/chat", json={"turns": turns})
        body = response.json()
        assert body["done"] is False
        turns.append({"question": body["question"], "answer": "Ответ"})

    response = client.post("/api/interviews/chat", json={"turns": turns})
    body = response.json()
    assert body["done"] is True
    assert body["question"] is None


def test_pick_fallback_followup_does_not_repeat_used_questions() -> None:
    first = pick_fallback_followup(set(), "мало платят, деньги решают")
    second = pick_fallback_followup({first}, "мало платят, деньги решают")
    assert first != second


def test_heuristic_analyze_finds_known_category_and_quotes() -> None:
    passport = heuristic_analyze(SAMPLE_TRANSCRIPT)
    assert passport["primary_category"] == "Процессы и согласования"
    assert passport["risk_zone"] in {"low", "medium", "high"}
    assert len(passport["improvement_suggestions"]) >= 3
    assert passport["generated_by"] == "heuristic"

    lowered_transcript = SAMPLE_TRANSCRIPT.lower()
    for item in passport["categories"]:
        assert item["quote"].lower() in lowered_transcript
    for item in passport["best_practices"]:
        assert item["quote"].lower() in lowered_transcript


def test_transcript_from_turns_terminates_answers_for_clean_sentence_splits() -> None:
    # Without a trailing terminator, the heuristic's sentence splitter would
    # run an answer straight into the next question and pollute the quote.
    turns = [ChatTurn(question="В каком отделе вы работали?", answer="Разработка")]
    transcript = _transcript_from_turns(turns)
    assert transcript == "— В каком отделе вы работали? — Разработка."

    two_turn_transcript = _transcript_from_turns(
        [
            ChatTurn(question="Почему уходите?", answer="Мало платят"),
            ChatTurn(question="А ещё что-то?", answer="Руководитель не слушает"),
        ]
    )
    passport = heuristic_analyze(two_turn_transcript)
    quotes = {item["quote"] for item in passport["categories"]}
    # Each extracted quote must be exactly one answer sentence, never a run-on
    # of one answer into the next question/answer pair.
    assert quotes <= {"Мало платят.", "Руководитель не слушает."}


def test_heuristic_analyze_never_crashes_on_unmatched_text() -> None:
    passport = heuristic_analyze("Просто короткий нейтральный текст без маркеров.")
    assert passport["primary_category"]
    assert passport["categories"]
    assert len(passport["improvement_suggestions"]) >= 3
    assert passport["sentiment_arc"]
