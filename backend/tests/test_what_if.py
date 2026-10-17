from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_what_if_matches_saved_model_and_keeps_original_independent() -> None:
    original = {"transaction_id": "scenario-1", "step": 150, "merchant": "M348934600", "category": "es_transportation", "amount": 10}
    original_response = client.post("/api/what-if", json=original)
    edited_response = client.post("/api/what-if", json={**original, "amount": 1000, "category": "es_travel"})
    assert original_response.status_code == edited_response.status_code == 200
    original_result, edited_result = original_response.json(), edited_response.json()
    assert original_result["scenario"] == edited_result["scenario"] == "hypothetical"
    assert original_result["risk_score"] != edited_result["risk_score"]
    assert original_result["risk_score"] == client.post("/api/explain", json=original).json()["risk_score"]
    assert original["amount"] == 10 and original["category"] == "es_transportation"
    assert edited_result["would_alert"] == (edited_result["risk_score"] >= edited_result["threshold"])
