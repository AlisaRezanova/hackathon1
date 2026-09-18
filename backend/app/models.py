"""SQLAlchemy 2.0 ORM models — the frozen DB schema for this hackathon.

FROZEN once both feature owners start working: schema changes go through
`make reset-data` (drop + `Base.metadata.create_all()` + `scripts/seed.py`),
never through migrations. See hackathon-vibecoding-guide.md ("Швы").

Domain: Exit Interview Intelligence. `ExitInterview` holds one raw,
anonymized transcript (the input dataset from the assignment); `ExitAnalysis`
holds the structured "problem passport" produced from it (the output
contract: exit_reason / pain_points / best_practices / risk_zone /
improvement_suggestions, plus a sentiment_arc). `scripts/seed.py` fills both
tables with ready-made demo data, so the `analytics` feature never has to
wait on the `interviews` feature's live pipeline to produce anything.
"""

import enum
from datetime import date

from sqlalchemy import JSON, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class ExitReason(enum.StrEnum):
    MONEY = "money"
    CAREER = "career"
    CLIMATE = "climate"
    UNFULFILLMENT = "unfulfillment"


class RiskZone(enum.StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)

    interviews: Mapped[list["ExitInterview"]] = relationship(back_populates="department")


class ExitInterview(Base):
    """One raw, anonymized exit-interview transcript (the input dataset)."""

    __tablename__ = "exit_interviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_alias: Mapped[str] = mapped_column(String(80))
    position: Mapped[str] = mapped_column(String(120))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    interview_date: Mapped[date]
    transcript: Mapped[str] = mapped_column(Text)

    department: Mapped[Department] = relationship(back_populates="interviews")
    analysis: Mapped["ExitAnalysis | None"] = relationship(
        back_populates="interview", uselist=False
    )


class ExitAnalysis(Base):
    """Structured "problem passport" produced from one transcript.

    JSON columns hold small, UI-shaped structures rather than normalized
    tables — matches the assignment's output contract 1:1 and both features
    only ever read/write it as JSON, never query inside it.
    """

    __tablename__ = "exit_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    interview_id: Mapped[int] = mapped_column(ForeignKey("exit_interviews.id"), unique=True)
    exit_reason: Mapped[ExitReason] = mapped_column(Enum(ExitReason, name="exit_reason"))
    risk_zone: Mapped[RiskZone] = mapped_column(Enum(RiskZone, name="risk_zone"))
    pain_points: Mapped[list] = mapped_column(JSON)  # [{"label": str, "mentions": int}]
    best_practices: Mapped[list] = mapped_column(JSON)  # [{"label": str, "quote": str}]
    improvement_suggestions: Mapped[list] = mapped_column(JSON)  # list[str], >= 3 items
    sentiment_arc: Mapped[list] = mapped_column(JSON)  # list[float] in [-1, 1], over the dialogue
    generated_by: Mapped[str] = mapped_column(
        String(20), default="heuristic"
    )  # "llm" | "heuristic"

    interview: Mapped[ExitInterview] = relationship(back_populates="analysis")
