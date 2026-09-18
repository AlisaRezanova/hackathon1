"""API router for the `analytics` feature — owned by Alisa.

Company-wide aggregation read from `ExitInterview` / `ExitAnalysis` (see
app/models.py). Read-only: never writes, never calls `features/interviews`.
Do not touch main.py — it already wires this router in via `include_router`.
"""

from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.features.analytics.llm import summarize_cluster
from app.features.analytics.schemas import (
    AnalyticsSummary,
    CategoryDrilldown,
    CategoryQuote,
    CategoryShare,
    DepartmentRisk,
    SubtypeCount,
)
from app.models import Department, ExitAnalysis, ExitInterview

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Keyed by (category, total row count) so a new interview naturally busts
# the cache. In-process only — fine for a single-instance demo backend, and
# it's what makes repeat clicks on the same category instant despite the
# live LLM call.
_drilldown_cache: dict[tuple[str, int], CategoryDrilldown] = {}


def _analysis_rows(db: Session):
    return db.execute(
        select(ExitAnalysis, ExitInterview, Department)
        .join(ExitInterview, ExitAnalysis.interview_id == ExitInterview.id)
        .join(Department, ExitInterview.department_id == Department.id)
    ).all()


@router.get("/summary", response_model=AnalyticsSummary)
def summary(db: Session = Depends(get_db)) -> AnalyticsSummary:
    rows = _analysis_rows(db)
    total = len(rows)

    category_counts: Counter[str] = Counter()
    dept_risk: dict[str, dict[str, int]] = defaultdict(lambda: {"low": 0, "medium": 0, "high": 0})

    for analysis, _interview, department in rows:
        category_counts[analysis.primary_category] += 1
        dept_risk[department.name][analysis.risk_zone.value] += 1

    category_breakdown = [
        CategoryShare(
            category=category,
            count=count,
            percent=round(count / total * 100, 1) if total else 0.0,
        )
        for category, count in category_counts.most_common()
    ]

    department_risk = [
        DepartmentRisk(
            department=name,
            total=(dept_total := counts["low"] + counts["medium"] + counts["high"]),
            low=counts["low"],
            medium=counts["medium"],
            high=counts["high"],
            high_percent=round(counts["high"] / dept_total * 100, 1) if dept_total else 0.0,
        )
        for name, counts in dept_risk.items()
    ]
    department_risk.sort(key=lambda d: d.high_percent, reverse=True)

    return AnalyticsSummary(
        total_interviews=total,
        category_breakdown=category_breakdown,
        department_risk=department_risk,
    )


@router.get("/categories/{category}", response_model=CategoryDrilldown)
def category_drilldown(category: str, db: Session = Depends(get_db)) -> CategoryDrilldown:
    rows = _analysis_rows(db)

    cache_key = (category, len(rows))
    if cache_key in _drilldown_cache:
        return _drilldown_cache[cache_key]

    subtype_counts: Counter[str] = Counter()
    quotes: list[CategoryQuote] = []
    suggestions: list[str] = []
    interview_ids: set[int] = set()

    for analysis, interview, department in rows:
        matched = False
        for entry in analysis.categories:
            if entry.get("category") != category:
                continue
            matched = True
            subtype_counts[entry.get("subtype") or "Без подтипа"] += 1
            quote = entry.get("quote")
            if quote:
                quotes.append(
                    CategoryQuote(
                        quote=quote, department=department.name, position=interview.position
                    )
                )
        if matched:
            interview_ids.add(interview.id)
        if analysis.primary_category == category:
            suggestions.extend(analysis.improvement_suggestions)

    if not subtype_counts:
        raise HTTPException(status_code=404, detail=f"Категория '{category}' не найдена")

    subtypes = [SubtypeCount(subtype=s, count=c) for s, c in subtype_counts.most_common()]
    top_subtypes = ", ".join(s.subtype for s in subtypes[:3])
    total_mentions = sum(subtype_counts.values())

    heuristic_summary = (
        f"«{category}» встречается в {len(interview_ids)} из {len(rows)} интервью "
        f"({total_mentions} упоминаний). Основные подтипы: {top_subtypes}."
    )
    if suggestions:
        heuristic_summary += f" Частое предложение по улучшению: «{suggestions[0]}»."

    insight = summarize_cluster(
        category=category,
        subtypes=[s.subtype for s in subtypes],
        quotes=[q.quote for q in quotes],
        total_mentions=total_mentions,
        interview_count=len(interview_ids),
    )

    quotes_by_text = {q.quote: q for q in quotes}
    top_quotes = (
        [quotes_by_text[t] for t in insight.top_quotes if t in quotes_by_text] if insight else []
    )
    if not top_quotes:
        top_quotes = quotes[:3]

    result = CategoryDrilldown(
        category=category,
        total_mentions=total_mentions,
        interview_count=len(interview_ids),
        subtypes=subtypes,
        quotes=top_quotes,
        summary=insight.summary if insight else heuristic_summary,
        generated_by="llm" if insight else "heuristic",
    )
    _drilldown_cache[cache_key] = result
    return result
