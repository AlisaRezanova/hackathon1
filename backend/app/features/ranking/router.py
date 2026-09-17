"""API router for the `ranking` feature — owned by one participant.

Stub endpoint only; replace with real endpoints reading from `Candidate` /
`Department` (see app/models.py). Do not touch main.py — it already wires
this router in via `include_router`.
"""

from fastapi import APIRouter

from app.features.ranking.schemas import RankingPlaceholder

router = APIRouter(prefix="/api/ranking", tags=["ranking"])


@router.get("/ping", response_model=RankingPlaceholder)
def ping() -> RankingPlaceholder:
    return RankingPlaceholder(message="ranking feature not implemented yet")
