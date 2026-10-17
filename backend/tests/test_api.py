"""Exercise the CSV-to-score contract and its important failure modes."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import app


ROOT = Path(__file__).resolve().parents[2]
client = TestClient(app)


def post_csv(text: str, name: str = "batch.csv"):
    return client.post("/api/batches/score", files={"file": (name, text.encode("utf-8"), "text/csv")})


def test_labeled_demo_scores_every_row_and_matches_counts() -> None:
    with (ROOT / "data" / "sample_labeled.csv").open("rb") as source:
        response = client.post("/api/batches/score", files={"file": ("demo.csv", source, "text/csv")})
    assert response.status_code == 200
    batch = response.json()
    assert batch["mode"] == "evaluation"
    assert batch["cleaning"]["valid_rows"] == 2000
    assert len(batch["rows"]) == 2000
    assert sum(row["fraud"] for row in batch["rows"]) == 20
    assert len({row["step"] for row in batch["rows"]}) == 36
    assert all(0 <= row["risk_score"] <= 1 for row in batch["rows"])
    assert batch["alert_count"] == sum(row["risk_score"] >= batch["default_threshold"] for row in batch["rows"])
    confusion = batch["evaluation"]["confusion"]
    assert sum(confusion.values()) == 2000
    assert confusion["tp"] + confusion["fn"] == 20
    assert sum(bucket["count"] for bucket in batch["eda"]["amount_distribution"]) == 2000


def test_unlabeled_and_single_class_batches_do_not_invent_metrics() -> None:
    text = "transaction_id,step,merchant,category,amount\na,150,M348934600,es_transportation,10\nb,150,M348934600,es_transportation,20\n"
    response = post_csv(text)
    assert response.status_code == 200
    batch = response.json()
    assert batch["mode"] == "scoring"
    assert "evaluation" not in batch and "fraud_rate" not in batch["eda"]
    assert len(batch["rows"]) == 2

    one_class = post_csv(text.replace("amount\n", "amount,fraud\n").replace(",10\n", ",10,0\n").replace(",20\n", ",20,0\n"))
    assert one_class.status_code == 200
    assert one_class.json()["evaluation"]["average_precision"] is None
    assert one_class.json()["evaluation"]["roc_auc"] is None


def test_validation_reports_dropped_rows_duplicates_and_unknown_codes() -> None:
    text = (
        "transaction_id,step,merchant,category,amount,fraud\n"
        "a,150,M348934600,es_transportation,10,0\n"
        "a,150,M348934600,es_transportation,10,0\n"
        "b,nope,M348934600,es_transportation,20,0\n"
        "c,150,NEW_MERCHANT,NEW_CATEGORY,30,1\n"
    )
    response = post_csv(text)
    assert response.status_code == 200
    report = response.json()["cleaning"]
    assert report["input_rows"] == 4
    assert report["valid_rows"] == 2
    assert report["duplicate_rows"] == 1
    assert report["dropped_rows"] == 1
    assert report["unknown_merchant_rows"] == 1
    assert report["unknown_category_rows"] == 1
    assert report["drop_reasons"] == {"invalid_step": 1}
    assert report["input_rows"] == report["valid_rows"] + report["duplicate_rows"] + report["dropped_rows"]


def test_bad_columns_labels_and_conflicting_ids_have_clear_errors() -> None:
    bad_columns = post_csv("id,amount\na,10\n")
    assert bad_columns.status_code == 422
    assert bad_columns.json()["code"] == "columns"
    assert "transaction_id" in bad_columns.json()["details"]["missing"]

    bad_label = post_csv("transaction_id,step,merchant,category,amount,fraud\na,1,M348934600,es_transportation,10,maybe\n")
    assert bad_label.status_code == 422
    assert bad_label.json()["code"] == "invalid_label"

    conflict = post_csv("transaction_id,step,merchant,category,amount\na,1,M348934600,es_transportation,10\na,1,M348934600,es_transportation,20\n")
    assert conflict.status_code == 422
    assert conflict.json()["code"] == "conflicting_id"


def test_meta_and_downloads_match_artifacts() -> None:
    health = client.get("/api/health").json()
    meta = client.get("/api/meta").json()
    lab = client.get("/api/model-lab").json()
    assert health["model_status"] == "loaded"
    assert health["model_version"] == meta["model_version"] == lab["artifact_version"]
    assert meta["selected_model"] == lab["selected_model"]
    assert client.get("/api/template.csv").status_code == 200
    assert client.get("/api/demo.csv").status_code == 200


def test_upload_limits_reject_large_files_and_batches() -> None:
    oversized = client.post(
        "/api/batches/score",
        files={"file": ("large.csv", b"x" * (5 * 1024 * 1024 + 1), "text/csv")},
    )
    assert oversized.status_code == 413
    assert oversized.json()["code"] == "file_too_large"

    header = "transaction_id,step,merchant,category,amount\n"
    rows = "".join(f"id-{i},150,M348934600,es_transportation,10\n" for i in range(20_001))
    too_many = post_csv(header + rows)
    assert too_many.status_code == 413
    assert too_many.json()["code"] == "too_many_rows"
