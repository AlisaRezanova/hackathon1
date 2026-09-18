"""Pydantic v2 request/response schemas for the `analytics` feature.

Company-wide summary (% by primary_category, risk by department) and a
per-category drill-down (subtypes, quotes, heuristic cluster summary),
aggregated from `app.models.ExitAnalysis` / `ExitInterview`.
"""

from pydantic import BaseModel


class CategoryShare(BaseModel):
    category: str
    count: int
    percent: float


class DepartmentRisk(BaseModel):
    department: str
    total: int
    low: int
    medium: int
    high: int
    high_percent: float


class AnalyticsSummary(BaseModel):
    total_interviews: int
    category_breakdown: list[CategoryShare]
    department_risk: list[DepartmentRisk]


class SubtypeCount(BaseModel):
    subtype: str
    count: int


class CategoryQuote(BaseModel):
    quote: str
    department: str
    position: str


class CategoryDrilldown(BaseModel):
    category: str
    total_mentions: int
    interview_count: int
    subtypes: list[SubtypeCount]
    quotes: list[CategoryQuote]
    summary: str
