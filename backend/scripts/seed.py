"""Seed the database with synthetic HR demo data — FROZEN seam.

Fills every table in one place so both features read from the same demo
data instead of from each other's output. No real personal data.

Idempotent: if departments already exist, does nothing (safe to re-run via
`make seed`). To force a clean reseed, use `make reset-data`.

Run inside the backend container: `python -m scripts.seed` (see Makefile).
"""

import random
from datetime import date, datetime, timedelta

from app.db import Base, SessionLocal, engine
from app.models import Candidate, CandidateStage, Department, Employee, EmployeeStatus

DEPARTMENTS = ["Engineering", "Sales", "Customer Support", "People", "Marketing"]

POSITIONS = {
    "Engineering": ["Backend Engineer", "Frontend Engineer", "QA Engineer", "DevOps Engineer"],
    "Sales": ["Account Executive", "Sales Development Rep", "Sales Manager"],
    "Customer Support": ["Support Specialist", "Support Team Lead"],
    "People": ["HR Business Partner", "Recruiter", "People Ops Analyst"],
    "Marketing": ["Marketing Manager", "Content Specialist", "Growth Analyst"],
}

TERMINATION_REASONS = [
    "Better offer elsewhere",
    "Relocation",
    "Career change",
    "Compensation",
    "Manager conflict",
    "Burnout",
]

FIRST_NAMES = [
    "Anna",
    "Boris",
    "Elena",
    "Igor",
    "Maria",
    "Nikolai",
    "Olga",
    "Pavel",
    "Svetlana",
    "Viktor",
    "Yulia",
    "Dmitri",
    "Ksenia",
    "Sergei",
    "Tatiana",
]
LAST_NAMES = [
    "Ivanova",
    "Petrov",
    "Smirnova",
    "Kuznetsov",
    "Sokolova",
    "Popov",
    "Volkova",
    "Fedorov",
    "Morozova",
    "Novikov",
]


def _random_name(rng: random.Random) -> str:
    return f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"


def seed() -> None:
    Base.metadata.create_all(bind=engine)

    rng = random.Random(42)
    session = SessionLocal()
    try:
        if session.query(Department).first() is not None:
            print("Seed skipped: data already present.")
            return

        departments = [Department(name=name) for name in DEPARTMENTS]
        session.add_all(departments)
        session.flush()

        today = date.today()

        for dept in departments:
            positions = POSITIONS[dept.name]
            employee_count = rng.randint(4, 7)
            for _ in range(employee_count):
                hire_date = today - timedelta(days=rng.randint(60, 1500))
                is_terminated = rng.random() < 0.25
                termination_date = None
                termination_reason = None
                status = EmployeeStatus.ACTIVE
                if is_terminated:
                    status = EmployeeStatus.TERMINATED
                    termination_date = hire_date + timedelta(days=rng.randint(90, 900))
                    termination_reason = rng.choice(TERMINATION_REASONS)

                session.add(
                    Employee(
                        full_name=_random_name(rng),
                        position=rng.choice(positions),
                        department_id=dept.id,
                        hire_date=hire_date,
                        status=status,
                        termination_date=termination_date,
                        termination_reason=termination_reason,
                        performance_score=round(rng.uniform(2.5, 5.0), 1),
                        engagement_score=round(rng.uniform(2.0, 5.0), 1),
                    )
                )

            candidate_count = rng.randint(3, 6)
            for _ in range(candidate_count):
                applied_at = datetime.now() - timedelta(days=rng.randint(1, 60))
                stage = rng.choice(list(CandidateStage))
                session.add(
                    Candidate(
                        full_name=_random_name(rng),
                        position=rng.choice(positions),
                        department_id=dept.id,
                        applied_at=applied_at,
                        stage=stage,
                        score=round(rng.uniform(50, 99), 1),
                        years_experience=round(rng.uniform(0.5, 12), 1),
                        resume_summary=(
                            f"{rng.randint(1, 12)} years in {dept.name.lower()}-adjacent roles, "
                            f"strong communication and delivery track record."
                        ),
                    )
                )

        session.commit()
        print("Seed complete.")
    finally:
        session.close()


if __name__ == "__main__":
    seed()
