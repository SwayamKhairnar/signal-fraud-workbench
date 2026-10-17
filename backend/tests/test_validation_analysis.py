"""Validate the fixed validation error analysis artifact and API contract."""

from fastapi.testclient import TestClient

from backend.app.main import app


def test_validation_analysis_aggregates_and_sources() -> None:
    response = TestClient(app).get("/api/validation-analysis")
    assert response.status_code == 200
    data = response.json()
    assert data["source"].startswith("Validation partition")
    assert "108" in data["source"] and "143" in data["source"]
    overall = data["overall"]
    assert overall["rows"] == 128820
    assert overall["fraud"] == 1440
    assert overall["tp"] + overall["fn"] == overall["fraud"]
    assert overall["tp"] + overall["fp"] == overall["alerts"]
    assert overall["tn"] + overall["fp"] + overall["fn"] + overall["tp"] == overall["rows"]
    for key in ("by_amount", "by_category", "by_period"):
        assert sum(part["rows"] for part in data[key]) == overall["rows"]
        assert sum(part["fraud"] for part in data[key]) == overall["fraud"]
        assert sum(part["fn"] for part in data[key]) == overall["fn"]
    assert all(point["alerts"] <= following["alerts"] for point, following in zip(data["workload"], data["workload"][1:]))
