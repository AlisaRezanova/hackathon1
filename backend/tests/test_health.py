from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ranking_stub() -> None:
    response = client.get("/api/ranking/ping")
    assert response.status_code == 200


def test_turnover_stub() -> None:
    response = client.get("/api/turnover/ping")
    assert response.status_code == 200
