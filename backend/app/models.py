"""SQLAlchemy 2.0 ORM models — the frozen DB schema for this hackathon.

FROZEN once both feature owners start working: schema changes go through
`make reset-data` (drop + `Base.metadata.create_all()` + `scripts/seed.py`),
never through migrations. See hackathon-vibecoding-guide.md ("Швы").

Entities here are intentionally generic HR data (departments, employees,
candidates) so that any feature built on top of them can pick what it needs
without waiting on the other feature to produce data first.
"""

import enum
from datetime import date, datetime

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class EmployeeStatus(enum.StrEnum):
    ACTIVE = "active"
    TERMINATED = "terminated"


class CandidateStage(enum.StrEnum):
    APPLIED = "applied"
    INTERVIEW = "interview"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)

    employees: Mapped[list["Employee"]] = relationship(back_populates="department")
    candidates: Mapped[list["Candidate"]] = relationship(back_populates="department")


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    position: Mapped[str] = mapped_column(String(120))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    hire_date: Mapped[date]
    status: Mapped[EmployeeStatus] = mapped_column(
        Enum(EmployeeStatus, name="employee_status"), default=EmployeeStatus.ACTIVE
    )
    termination_date: Mapped[date | None] = mapped_column(default=None)
    termination_reason: Mapped[str | None] = mapped_column(String(200), default=None)
    performance_score: Mapped[float | None] = mapped_column(default=None)
    engagement_score: Mapped[float | None] = mapped_column(default=None)

    department: Mapped[Department] = relationship(back_populates="employees")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    position: Mapped[str] = mapped_column(String(120))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    applied_at: Mapped[datetime]
    stage: Mapped[CandidateStage] = mapped_column(
        Enum(CandidateStage, name="candidate_stage"), default=CandidateStage.APPLIED
    )
    score: Mapped[float | None] = mapped_column(default=None)
    years_experience: Mapped[float | None] = mapped_column(default=None)
    resume_summary: Mapped[str | None] = mapped_column(Text, default=None)

    department: Mapped[Department] = relationship(back_populates="candidates")
