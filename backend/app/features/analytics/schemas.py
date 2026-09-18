"""Pydantic v2 request/response schemas for the `analytics` feature.

Stub — the feature owner (Alisa) defines the real company-wide summary
schema here, aggregated from `app.models.ExitAnalysis`.
"""

from pydantic import BaseModel


class AnalyticsPlaceholder(BaseModel):
    message: str
