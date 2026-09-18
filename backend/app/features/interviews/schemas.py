"""Pydantic v2 request/response schemas for the `interviews` feature.

Stub — the feature owner (Kostya) defines the real analyze request/response
schemas here, shaped like `app.models.ExitAnalysis`.
"""

from pydantic import BaseModel


class InterviewsPlaceholder(BaseModel):
    message: str
