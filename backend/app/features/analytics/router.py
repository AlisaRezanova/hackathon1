"""API router for the `analytics` feature — owned by Alisa.

Stub endpoint only; replace with the real company-wide aggregation reading
`ExitInterview` / `ExitAnalysis` (see app/models.py). Do not touch main.py —
it already wires this router in via `include_router`.
"""

from fastapi import APIRouter

from app.features.analytics.schemas import AnalyticsPlaceholder

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/ping", response_model=AnalyticsPlaceholder)
def ping() -> AnalyticsPlaceholder:
    return AnalyticsPlaceholder(message="analytics feature not implemented yet")
