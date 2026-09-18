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
from app.features.analytics.llm import advise_on_category, summarize_cluster, summarize_department
from app.features.analytics.schemas import (
    AnalyticsSummary,
    CategoryAdvice,
    CategoryDrilldown,
    CategoryQuote,
    CategoryShare,
    DepartmentDrilldown,
    DepartmentRisk,
    InterviewListItem,
    SubtypeCount,
)
from app.models import Department, ExitAnalysis, ExitInterview

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Keyed by (category, total row count) so a new interview naturally busts
# the cache. In-process only — fine for a single-instance demo backend, and
# it's what makes repeat clicks on the same category instant despite the
# live LLM call.
_drilldown_cache: dict[tuple[str, int], CategoryDrilldown] = {}
_advice_cache: dict[tuple[str, int], CategoryAdvice] = {}
_department_cache: dict[tuple[str, int], DepartmentDrilldown] = {}


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


@router.get("/interviews", response_model=list[InterviewListItem])
def interviews(db: Session = Depends(get_db)) -> list[InterviewListItem]:
    rows = _analysis_rows(db)
    items = [
        InterviewListItem(
            id=interview.id,
            employee_alias=interview.employee_alias,
            position=interview.position,
            department=department.name,
            interview_date=interview.interview_date,
            primary_category=analysis.primary_category,
            risk_zone=analysis.risk_zone.value,
        )
        for analysis, interview, department in rows
    ]
    items.sort(key=lambda i: i.interview_date, reverse=True)
    return items


class _CategoryContext:
    def __init__(
        self,
        subtypes: list[SubtypeCount],
        quotes: list[CategoryQuote],
        suggestions: list[str],
        interview_ids: set[int],
    ) -> None:
        self.subtypes = subtypes
        self.quotes = quotes
        self.suggestions = suggestions
        self.interview_ids = interview_ids


def _category_context(category: str, rows) -> _CategoryContext:
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

    subtypes = [SubtypeCount(subtype=s, count=c) for s, c in subtype_counts.most_common()]
    return _CategoryContext(subtypes, quotes, suggestions, interview_ids)


def _fallback_solutions(subtypes: list[str], suggestions: list[str]) -> list[str]:
    """At least 3 generic-but-grounded next steps when the LLM is unavailable."""
    deduped: list[str] = []
    for s in suggestions:
        if s not in deduped:
            deduped.append(s)
    if len(deduped) < 3:
        for subtype in subtypes:
            step = f"Разобрать «{subtype}» с командой и назначить ответственного за исправление"
            if step not in deduped:
                deduped.append(step)
            if len(deduped) >= 3:
                break
    if len(deduped) < 3:
        deduped.append(
            "Провести повторные интервью с текущими сотрудниками отдела, чтобы "
            "проверить масштаб проблемы"
        )
    return deduped[:5]


@router.get("/categories/{category}", response_model=CategoryDrilldown)
def category_drilldown(category: str, db: Session = Depends(get_db)) -> CategoryDrilldown:
    rows = _analysis_rows(db)

    cache_key = (category, len(rows))
    if cache_key in _drilldown_cache:
        return _drilldown_cache[cache_key]

    ctx = _category_context(category, rows)
    if not ctx.subtypes:
        raise HTTPException(status_code=404, detail=f"Категория '{category}' не найдена")

    top_subtypes = ", ".join(s.subtype for s in ctx.subtypes[:3])
    total_mentions = sum(s.count for s in ctx.subtypes)

    heuristic_summary = (
        f"«{category}» встречается в {len(ctx.interview_ids)} из {len(rows)} интервью "
        f"({total_mentions} упоминаний). Основные подтипы: {top_subtypes}."
    )
    if ctx.suggestions:
        heuristic_summary += f" Частое предложение по улучшению: «{ctx.suggestions[0]}»."

    insight = summarize_cluster(
        category=category,
        subtypes=[s.subtype for s in ctx.subtypes],
        quotes=[q.quote for q in ctx.quotes],
        total_mentions=total_mentions,
        interview_count=len(ctx.interview_ids),
    )

    quotes_by_text = {q.quote: q for q in ctx.quotes}
    top_quotes = (
        [quotes_by_text[t] for t in insight.top_quotes if t in quotes_by_text] if insight else []
    )
    if not top_quotes:
        top_quotes = ctx.quotes[:3]

    result = CategoryDrilldown(
        category=category,
        total_mentions=total_mentions,
        interview_count=len(ctx.interview_ids),
        subtypes=ctx.subtypes,
        quotes=top_quotes,
        summary=insight.summary if insight else heuristic_summary,
        generated_by="llm" if insight else "heuristic",
    )
    _drilldown_cache[cache_key] = result
    return result


@router.get("/categories/{category}/advice", response_model=CategoryAdvice)
def category_advice(category: str, db: Session = Depends(get_db)) -> CategoryAdvice:
    """Lazily-fetched (button click) so opening the drill-down drawer itself
    stays fast — see `category_drilldown` / `advise_on_category`."""
    rows = _analysis_rows(db)

    cache_key = (category, len(rows))
    if cache_key in _advice_cache:
        return _advice_cache[cache_key]

    ctx = _category_context(category, rows)
    if not ctx.subtypes:
        raise HTTPException(status_code=404, detail=f"Категория '{category}' не найдена")

    subtype_names = [s.subtype for s in ctx.subtypes]
    solutions = advise_on_category(
        category=category,
        subtypes=subtype_names,
        quotes=[q.quote for q in ctx.quotes],
    )
    generated_by = "llm"
    if solutions is None:
        solutions = _fallback_solutions(subtype_names, ctx.suggestions)
        generated_by = "heuristic"

    result = CategoryAdvice(category=category, solutions=solutions, generated_by=generated_by)
    _advice_cache[cache_key] = result
    return result


@router.get("/departments/{department}", response_model=DepartmentDrilldown)
def department_drilldown(department: str, db: Session = Depends(get_db)) -> DepartmentDrilldown:
    rows = _analysis_rows(db)

    cache_key = (department, len(rows))
    if cache_key in _department_cache:
        return _department_cache[cache_key]

    risk_counts = {"low": 0, "medium": 0, "high": 0}
    category_counts: Counter[str] = Counter()
    matched_total = 0

    for analysis, _interview, dept in rows:
        if dept.name != department:
            continue
        matched_total += 1
        risk_counts[analysis.risk_zone.value] += 1
        category_counts[analysis.primary_category] += 1

    if matched_total == 0:
        raise HTTPException(status_code=404, detail=f"Отдел '{department}' не найден")

    high_percent = round(risk_counts["high"] / matched_total * 100, 1)
    top_categories = [
        CategoryShare(
            category=name,
            count=count,
            percent=round(count / matched_total * 100, 1),
        )
        for name, count in category_counts.most_common()
    ]
    top_names = ", ".join(c.category for c in top_categories[:3])

    heuristic_summary = (
        f"В отделе «{department}» {risk_counts['high']} из {matched_total} интервью с высоким "
        f"риском ухода ({high_percent}%). Основные причины: {top_names}."
        if top_names
        else f"В отделе «{department}» пока недостаточно данных для выводов."
    )

    insight = summarize_department(
        department=department,
        high_percent=high_percent,
        total=matched_total,
        high=risk_counts["high"],
        top_categories=[(c.category, c.count) for c in top_categories],
    )

    result = DepartmentDrilldown(
        department=department,
        total=matched_total,
        low=risk_counts["low"],
        medium=risk_counts["medium"],
        high=risk_counts["high"],
        high_percent=high_percent,
        top_categories=top_categories,
        summary=insight.summary if insight else heuristic_summary,
        generated_by="llm" if insight else "heuristic",
    )
    _department_cache[cache_key] = result
    return result
