"""Pydantic v2 request/response schemas for the `interviews` feature.

Shaped around `app.models.ExitAnalysis` — see HACKATHON.md for the contract
between features. `ChatTurn`/`ChatRequest` model a stateless chat: the
client resends the accumulated question/answer history on every call, the
server has no session state to keep.
"""

from datetime import date

from pydantic import BaseModel, Field

QuestionKind = str  # "base" | "followup"
GeneratedBy = str  # "llm" | "heuristic"


class InterviewsPlaceholder(BaseModel):
    message: str


class ChatTurn(BaseModel):
    question: str
    answer: str


class ChatRequest(BaseModel):
    turns: list[ChatTurn] = Field(default_factory=list)


class ChatResponse(BaseModel):
    question: str | None = None
    done: bool
    step: int  # 1-based index of the question just asked (or last one, when done)
    kind: QuestionKind = "base"
    generated_by: GeneratedBy = "heuristic"
    department_options: list[str] | None = None  # quick-reply hint for step 1


class CategoryItem(BaseModel):
    category: str
    subtype: str
    quote: str
    mentions: int = 1


class BestPractice(BaseModel):
    label: str
    quote: str


class PassportOut(BaseModel):
    primary_category: str
    risk_zone: str
    categories: list[CategoryItem]
    best_practices: list[BestPractice]
    improvement_suggestions: list[str]
    sentiment_arc: list[float]
    generated_by: GeneratedBy


class AnalyzeRequest(BaseModel):
    """Either a finished chat (`turns`) or a pasted transcript (`transcript`)."""

    turns: list[ChatTurn] | None = None
    transcript: str | None = None
    department: str | None = None
    position: str | None = None
    employee_alias: str | None = None


class AnalyzeResponse(BaseModel):
    interview_id: int
    transcript: str
    passport: PassportOut


class InterviewListItem(BaseModel):
    id: int
    employee_alias: str
    position: str
    department: str
    interview_date: date
    source: str
    primary_category: str | None = None
    risk_zone: str | None = None
    generated_by: str | None = None


class InterviewDetail(InterviewListItem):
    transcript: str
    passport: PassportOut | None = None
