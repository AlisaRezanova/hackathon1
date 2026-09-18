from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_interviews_stub() -> None:
    response = client.get("/api/interviews/ping")
    assert response.status_code == 200


def test_analytics_stub() -> None:
    response = client.get("/api/analytics/ping")
    assert response.status_code == 200
