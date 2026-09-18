"""API router for the `interviews` feature — owned by Kostya.

Chat is stateless: the client resends the accumulated question/answer
history on every call, so there's no server-side session to manage. See
HACKATHON.md for the full scenario and `service.py` for the pipeline.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.features.interviews.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ChatRequest,
    ChatResponse,
    InterviewDetail,
    InterviewListItem,
    InterviewsPlaceholder,
)
from app.features.interviews.service import (
    analyze_and_save,
    build_chat_response,
    get_interview_detail,
    list_interviews,
)

router = APIRouter(prefix="/api/interviews", tags=["interviews"])

DbSession = Annotated[Session, Depends(get_db)]


@router.get("/ping", response_model=InterviewsPlaceholder)
def ping() -> InterviewsPlaceholder:
    return InterviewsPlaceholder(message="interviews feature ready")


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    return build_chat_response(request)


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest, db: DbSession) -> AnalyzeResponse:
    try:
        return analyze_and_save(db, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=list[InterviewListItem])
def list_all(db: DbSession) -> list[InterviewListItem]:
    return list_interviews(db)


@router.get("/{interview_id}", response_model=InterviewDetail)
def get_one(interview_id: int, db: DbSession) -> InterviewDetail:
    detail = get_interview_detail(db, interview_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Interview not found")
    return detail
