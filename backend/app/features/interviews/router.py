"""API router for the `interviews` feature — owned by Kostya.

Stub endpoint only; replace with the real transcript -> "problem passport"
pipeline reading/writing `ExitInterview` / `ExitAnalysis` (see
app/models.py). Do not touch main.py — it already wires this router in via
`include_router`.
"""

from fastapi import APIRouter

from app.features.interviews.schemas import InterviewsPlaceholder

router = APIRouter(prefix="/api/interviews", tags=["interviews"])


@router.get("/ping", response_model=InterviewsPlaceholder)
def ping() -> InterviewsPlaceholder:
    return InterviewsPlaceholder(message="interviews feature not implemented yet")
