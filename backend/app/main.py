"""FastAPI entrypoint — FROZEN seam. Both feature routers are wired in here;
do not add feature-specific logic in this file, add it inside
`app/features/<domain>/`. See hackathon-vibecoding-guide.md ("Швы").
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.features.analytics.router import router as analytics_router
from app.features.interviews.router import router as interviews_router

app = FastAPI(title="Hackathon HR prototype API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(interviews_router)
app.include_router(analytics_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
