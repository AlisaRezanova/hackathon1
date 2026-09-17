"""Pydantic v2 request/response schemas for the `ranking` feature.

Stub — the feature owner defines real schemas here.
"""

from pydantic import BaseModel


class RankingPlaceholder(BaseModel):
    message: str
