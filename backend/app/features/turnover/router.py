"""API router for the `turnover` feature — owned by one participant.

Stub endpoint only; replace with real endpoints reading from `Employee` /
`Department` (see app/models.py). Do not touch main.py — it already wires
this router in via `include_router`.
"""

from fastapi import APIRouter

from app.features.turnover.schemas import TurnoverPlaceholder

router = APIRouter(prefix="/api/turnover", tags=["turnover"])


@router.get("/ping", response_model=TurnoverPlaceholder)
def ping() -> TurnoverPlaceholder:
    return TurnoverPlaceholder(message="turnover feature not implemented yet")
