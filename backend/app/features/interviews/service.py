"""Pipeline: chat state machine + transcript -> "problem passport" + persistence.

Analysis always prefers the LLM, but every LLM result is re-validated
against the transcript (quotes must be real substrings, fields must be
well-formed) before it's trusted — anything that fails falls back to the
deterministic heuristic in `heuristic.py`. This is the concrete
implementation of HACKATHON.md's "обязателен heuristic-fallback" rule and
of the case brief's "no hallucinated problems" requirement.
"""

from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.features.interviews.heuristic import (
    KNOWN_CATEGORIES,
    derive_preventability,
    heuristic_analyze,
)
from app.features.interviews.llm import generate_followup_question, generate_llm_passport
from app.features.interviews.questions import (
    BASE_QUESTIONS,
    DEPARTMENT_OPTIONS,
    MAX_FOLLOWUPS,
    pick_fallback_followup,
)
from app.features.interviews.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ChatRequest,
    ChatResponse,
    ChatTurn,
    InterviewDetail,
    InterviewListItem,
    PassportOut,
)
from app.models import Department, ExitAnalysis, ExitInterview, InterviewSource, RiskZone

_VALID_RISK_ZONES = {"low", "medium", "high"}
_VALID_PREVENTABILITY = {"low", "medium", "high"}


def build_chat_response(request: ChatRequest) -> ChatResponse:
    """Decide the next question given the accumulated history (stateless)."""
    turns = request.turns
    step = len(turns) + 1

    if step <= len(BASE_QUESTIONS):
        return ChatResponse(
            question=BASE_QUESTIONS[step - 1],
            done=False,
            step=step,
            kind="base",
            generated_by="heuristic",
            department_options=DEPARTMENT_OPTIONS if step == 1 else None,
        )

    followup_index = step - len(BASE_QUESTIONS)
    if followup_index > MAX_FOLLOWUPS:
        return ChatResponse(question=None, done=True, step=step - 1, kind="followup")

    llm_question = generate_followup_question(turns)
    if llm_question == "":
        # LLM explicitly signalled it has enough to build the passport.
        return ChatResponse(
            question=None, done=True, step=step - 1, kind="followup", generated_by="llm"
        )
    if llm_question:
        return ChatResponse(
            question=llm_question, done=False, step=step, kind="followup", generated_by="llm"
        )

    fallback_question = pick_fallback_followup(turns)
    return ChatResponse(
        question=fallback_question,
        done=False,
        step=step,
        kind="followup",
        generated_by="heuristic",
    )


def _transcript_from_turns(turns: list[ChatTurn]) -> str:
    """Render turns as seed-style dash dialogue, e.g. "— Q? — A. — Q? — A."

    Every answer gets a trailing sentence terminator if it lacks one — this
    matters for the heuristic's sentence splitter (`heuristic.split_sentences`),
    which breaks on `.!?`: without it, an answer without ending punctuation
    would run straight into the next question and pollute the extracted quote.
    """
    parts = []
    for turn in turns:
        answer = turn.answer.strip()
        if answer and answer[-1] not in ".!?":
            answer += "."
        parts.append(f"— {turn.question} — {answer}")
    return " ".join(parts)


def _passport_is_trustworthy(passport: dict, transcript: str) -> bool:
    """Reject anything that isn't well-formed or invents quotes."""
    if passport.get("risk_zone") not in _VALID_RISK_ZONES:
        return False

    categories = passport.get("categories")
    if not isinstance(categories, list):
        return False
    lowered_transcript = transcript.lower()
    for item in categories:
        if not isinstance(item, dict):
            return False
        quote = item.get("quote", "")
        if not quote or quote.lower() not in lowered_transcript:
            return False

    best_practices = passport.get("best_practices", [])
    if not isinstance(best_practices, list):
        return False
    for item in best_practices:
        if not isinstance(item, dict):
            return False
        quote = item.get("quote", "")
        if quote and quote.lower() not in lowered_transcript:
            return False

    suggestions = passport.get("improvement_suggestions")
    if not isinstance(suggestions, list) or len(suggestions) < 3:
        return False

    sentiment_arc = passport.get("sentiment_arc")
    if not isinstance(sentiment_arc, list) or not sentiment_arc:
        return False
    try:
        [float(v) for v in sentiment_arc]
    except (TypeError, ValueError):
        return False

    if passport.get("preventability") not in _VALID_PREVENTABILITY:
        return False
    if not str(passport.get("preventability_reason", "")).strip():
        return False

    return True


def _normalize_passport(passport: dict) -> dict:
    categories = []
    for item in passport.get("categories", []):
        categories.append(
            {
                "category": str(item.get("category", "Другое")),
                "subtype": str(item.get("subtype", "")),
                "quote": str(item.get("quote", "")),
                "mentions": int(item.get("mentions", 1) or 1),
            }
        )
    best_practices = [
        {"label": str(item.get("label", "")), "quote": str(item.get("quote", ""))}
        for item in passport.get("best_practices", [])
    ]
    sentiment_arc = [max(-1.0, min(1.0, float(v))) for v in passport.get("sentiment_arc", [])]
    preventability = passport.get("preventability")
    if preventability not in _VALID_PREVENTABILITY:
        preventability, preventability_reason = derive_preventability(
            passport["risk_zone"], categories, best_practices
        )
    else:
        preventability_reason = str(passport.get("preventability_reason", "")).strip()
    return {
        "primary_category": str(passport.get("primary_category", "Другое")),
        "risk_zone": passport["risk_zone"],
        "categories": categories,
        "best_practices": best_practices,
        "improvement_suggestions": [str(s) for s in passport.get("improvement_suggestions", [])],
        "sentiment_arc": sentiment_arc,
        "preventability": preventability,
        "preventability_reason": preventability_reason,
        "generated_by": passport.get("generated_by", "heuristic"),
    }


def build_passport(
    transcript: str, turns: list[ChatTurn] | None = None, known_categories: list[str] | None = None
) -> dict:
    """Try the LLM, validate it against the transcript, else use the heuristic."""
    llm_passport = generate_llm_passport(transcript, known_categories or KNOWN_CATEGORIES)
    if llm_passport is not None:
        llm_passport = {**llm_passport, "generated_by": "llm"}
        if _passport_is_trustworthy(llm_passport, transcript):
            return _normalize_passport(llm_passport)

    turn_dicts = [t.model_dump() for t in turns] if turns else None
    return _normalize_passport(heuristic_analyze(transcript, turn_dicts))


def _resolve_department(db: Session, name: str | None) -> Department:
    # Bug fixed here: the exact-match lookup used to run only when `name` was
    # given, so a second analyze with no department (e.g. a pasted transcript)
    # always tried to INSERT a fresh "Другое" row and hit the unique
    # constraint on the second call. Always look up by the final candidate.
    raw = (name or "").strip()
    candidate = raw or "Другое"
    existing = db.query(Department).filter(func.lower(Department.name) == candidate.lower()).first()
    if existing:
        return existing
    if raw:
        # Loose match: the chat answer may be a full sentence containing the name.
        for dept in db.query(Department).all():
            if dept.name.lower() in raw.lower():
                return dept
    department = Department(name=candidate)
    db.add(department)
    db.flush()
    return department


def analyze_and_save(db: Session, request: AnalyzeRequest) -> AnalyzeResponse:
    if request.transcript and request.transcript.strip():
        transcript = request.transcript.strip()
        turns = None
    elif request.turns:
        transcript = _transcript_from_turns(request.turns)
        turns = request.turns
    else:
        raise ValueError("Either 'turns' or 'transcript' is required")

    existing_categories = {
        row[0] for row in db.query(ExitAnalysis.primary_category).distinct().all()
    }
    known_categories = sorted(existing_categories | set(KNOWN_CATEGORIES))
    passport_dict = build_passport(transcript, turns, known_categories)

    department_name = request.department
    position = request.position
    if turns:
        if len(turns) > 0 and not department_name:
            department_name = turns[0].answer
        if len(turns) > 1 and not position:
            position = turns[1].answer
    department = _resolve_department(db, department_name)

    interview = ExitInterview(
        employee_alias=request.employee_alias or "Сотрудник (чат)",
        position=(position or "Не указано").strip()[:120],
        department_id=department.id,
        interview_date=date.today(),
        transcript=transcript,
        source=InterviewSource.CHAT,
    )
    db.add(interview)
    db.flush()

    analysis = ExitAnalysis(
        interview_id=interview.id,
        primary_category=passport_dict["primary_category"][:80],
        risk_zone=RiskZone(passport_dict["risk_zone"]),
        categories=passport_dict["categories"],
        best_practices=passport_dict["best_practices"],
        improvement_suggestions=passport_dict["improvement_suggestions"],
        sentiment_arc=passport_dict["sentiment_arc"],
        generated_by=passport_dict["generated_by"],
    )
    db.add(analysis)
    db.commit()

    return AnalyzeResponse(
        interview_id=interview.id,
        transcript=transcript,
        passport=PassportOut(**passport_dict),
    )


def list_interviews(db: Session) -> list[InterviewListItem]:
    interviews = (
        db.query(ExitInterview)
        .order_by(ExitInterview.interview_date.desc(), ExitInterview.id.desc())
        .all()
    )
    items = []
    for interview in interviews:
        analysis = interview.analysis
        items.append(
            InterviewListItem(
                id=interview.id,
                employee_alias=interview.employee_alias,
                position=interview.position,
                department=interview.department.name,
                interview_date=interview.interview_date,
                source=interview.source.value,
                primary_category=analysis.primary_category if analysis else None,
                risk_zone=analysis.risk_zone.value if analysis else None,
                generated_by=analysis.generated_by if analysis else None,
            )
        )
    return items


def get_interview_detail(db: Session, interview_id: int) -> InterviewDetail | None:
    interview = db.get(ExitInterview, interview_id)
    if interview is None:
        return None
    analysis = interview.analysis
    passport = None
    if analysis:
        # `preventability` isn't a DB column (models.py is frozen) — recomputed
        # deterministically from the stored fields for every read, so it's
        # available even for the 12 seeded interviews. See heuristic.py.
        preventability, preventability_reason = derive_preventability(
            analysis.risk_zone.value, analysis.categories, analysis.best_practices
        )
        passport = PassportOut(
            primary_category=analysis.primary_category,
            risk_zone=analysis.risk_zone.value,
            categories=analysis.categories,
            best_practices=analysis.best_practices,
            improvement_suggestions=analysis.improvement_suggestions,
            sentiment_arc=analysis.sentiment_arc,
            preventability=preventability,
            preventability_reason=preventability_reason,
            generated_by=analysis.generated_by,
        )
    return InterviewDetail(
        id=interview.id,
        employee_alias=interview.employee_alias,
        position=interview.position,
        department=interview.department.name,
        interview_date=interview.interview_date,
        source=interview.source.value,
        primary_category=analysis.primary_category if analysis else None,
        risk_zone=analysis.risk_zone.value if analysis else None,
        generated_by=analysis.generated_by if analysis else None,
        transcript=interview.transcript,
        passport=passport,
    )
