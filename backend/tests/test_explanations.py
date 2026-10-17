"""Explanations must reconstruct the exact score served to the queue."""

import math

from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_explanation_matches_score_and_contribution_sum() -> None:
    row = {"transaction_id": "case-1", "step": 150, "merchant": "M348934600", "category": "es_transportation", "amount": 27.5}
    scored = client.post("/api/batches/score", files={"file": ("case.csv", "transaction_id,step,merchant,category,amount\ncase-1,150,M348934600,es_transportation,27.5\n", "text/csv")}).json()
    response = client.post("/api/explain", json=row)
    assert response.status_code == 200
    data = response.json()
    assert math.isclose(data["risk_score"], scored["rows"][0]["risk_score"], abs_tol=1e-10)
    assert math.isclose(data["raw_log_odds"], data["baseline_log_odds"] + sum(x["contribution"] for x in data["factors"]), abs_tol=1e-8)
    assert math.isclose(data["risk_score"], 1 / (1 + math.exp(-data["raw_log_odds"])), abs_tol=1e-8)
    assert {x["factor"] for x in data["factors"]} == {"Simulation day", "Amount", "Merchant", "Purchase category"}


def test_unknown_codes_and_invalid_amount() -> None:
    row = {"transaction_id": "case-2", "step": 150, "merchant": "", "category": "new_category", "amount": 10}
    assert client.post("/api/explain", json=row).status_code == 200
    assert client.post("/api/explain", json={**row, "amount": -1}).status_code == 422
