"""SQLAlchemy 2.0 ORM models — the frozen DB schema for this hackathon.

FROZEN once both feature owners start working: schema changes go through
`make reset-data` (drop + `Base.metadata.create_all()` + `scripts/seed.py`),
never through migrations. See hackathon-vibecoding-guide.md ("Швы").

Domain: Exit Interview Intelligence. `ExitInterview` holds one transcript —
either pre-seeded, or produced live by Kostya's AI-interviewer chat (a short
fixed intro, then LLM-driven follow-ups). `ExitAnalysis` holds the
structured "problem passport" produced from it: a single top-line
`primary_category` plus `categories` — the normalized/clustered breakdown
("Проблемы с руководством" / "нет роста" / ... with subtypes and supporting
quotes) that Alisa's `analytics` feature aggregates into the org-wide
dashboard and drill-downs. `scripts/seed.py` fills both tables with
ready-made demo data, so `analytics` never has to wait on `interviews`' live
pipeline to produce anything.
"""

import enum
from datetime import date

from sqlalchemy import JSON, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class RiskZone(enum.StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class InterviewSource(enum.StrEnum):
    SEED = "seed"  # pre-loaded demo transcript
    CHAT = "chat"  # produced live by the AI-interviewer chat


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)

    interviews: Mapped[list["ExitInterview"]] = relationship(back_populates="department")


class ExitInterview(Base):
    """One anonymized exit-interview transcript (seeded, or from the chat)."""

    __tablename__ = "exit_interviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_alias: Mapped[str] = mapped_column(String(80))
    position: Mapped[str] = mapped_column(String(120))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    interview_date: Mapped[date]
    transcript: Mapped[str] = mapped_column(Text)
    source: Mapped[InterviewSource] = mapped_column(
        Enum(InterviewSource, name="interview_source"), default=InterviewSource.SEED
    )

    department: Mapped[Department] = relationship(back_populates="interviews")
    analysis: Mapped["ExitAnalysis | None"] = relationship(
        back_populates="interview", uselist=False
    )


class ExitAnalysis(Base):
    """Structured "problem passport" produced from one transcript.

    JSON columns hold small, UI-shaped structures rather than normalized
    tables — both features only ever read/write them as JSON, never query
    inside them. `categories` is intentionally free-text labels (not a fixed
    enum): the assignment expects the set of reasons to grow as new ones
    turn up in the data, not to be locked to a handful of buckets.
    """

    __tablename__ = "exit_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    interview_id: Mapped[int] = mapped_column(ForeignKey("exit_interviews.id"), unique=True)
    primary_category: Mapped[str] = mapped_column(String(80))  # top-1 reason, e.g. "Компенсация"
    risk_zone: Mapped[RiskZone] = mapped_column(Enum(RiskZone, name="risk_zone"))
    categories: Mapped[list] = mapped_column(JSON)  # [{"category","subtype","quote"}]
    best_practices: Mapped[list] = mapped_column(JSON)  # [{"label": str, "quote": str}]
    improvement_suggestions: Mapped[list] = mapped_column(JSON)  # list[str], >= 3 items
    sentiment_arc: Mapped[list] = mapped_column(JSON)  # list[float] in [-1, 1], over the dialogue
    generated_by: Mapped[str] = mapped_column(
        String(20), default="heuristic"
    )  # "llm" | "heuristic"

    interview: Mapped[ExitInterview] = relationship(back_populates="analysis")
