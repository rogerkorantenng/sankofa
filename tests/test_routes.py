import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock


@pytest.fixture
def client():
    with patch("poller.start_scheduler"), \
         patch("poller.stop_scheduler"), \
         patch("poller.SplunkClient"):
        from main import app
        return TestClient(app)


def test_get_alerts_returns_list(client):
    with patch("routes.alerts.get_alerts", new=AsyncMock(return_value=[])), \
         patch("routes.alerts.init_db", new=AsyncMock()):
        response = client.get("/alerts")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


def test_get_alert_not_found(client):
    with patch("routes.alerts.get_alert_with_report", new=AsyncMock(return_value=None)), \
         patch("routes.alerts.init_db", new=AsyncMock()):
        response = client.get("/alerts/nonexistent-id")
        assert response.status_code == 404
