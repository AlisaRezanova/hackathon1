"""Pydantic v2 request/response schemas for the `turnover` feature.

Stub — the feature owner defines real schemas here.
"""

from pydantic import BaseModel


class TurnoverPlaceholder(BaseModel):
    message: str
