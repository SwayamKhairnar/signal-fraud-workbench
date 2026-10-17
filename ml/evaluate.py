"""Evaluate saved candidates once on the untouched chronological test period."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import joblib
import numpy as np
from scipy import sparse
from sklearn.metrics import (
    average_precision_score, confusion_matrix, f1_score, precision_recall_curve,
    precision_score, recall_score, roc_auc_score, roc_curve,
)

from features import model_frame
from train import read_partition


def sampled_points(x: np.ndarray, y: np.ndarray, limit: int = 400) -> list[dict[str, float]]:
    if len(x) <= limit:
        indexes = np.arange(len(x))
    else:
        indexes = np.unique(np.linspace(0, len(x) - 1, limit, dtype=int))
    return [{"x": float(x[i]), "y": float(y[i])} for i in indexes]


def feature_group(name: str) -> str:
    if name == "numeric__step":
        return "Simulation day"
    if name == "numeric__log_amount":
        return "Amount"
    if name.startswith("categorical__merchant_"):
        return "Merchant"
    if name.startswith("categorical__category_"):
        return "Purchase category"
    raise ValueError(f"Unexpected transformed feature: {name}")


def global_importance(model_name: str, model: object, matrix: object, feature_names: list[str]) -> dict[str, float]:
    sample = matrix[: min(2000, matrix.shape[0])]
    if model_name == "logistic":
        values = sample.multiply(model.coef_[0]) if sparse.issparse(sample) else sample * model.coef_[0]
        contributions = values.toarray() if sparse.issparse(values) else np.asarray(values)
        expected = model.decision_function(sample)
        reconstructed = model.intercept_[0] + contributions.sum(axis=1)
    else:
        values = model.booster_.predict(sample, pred_contrib=True)
        values = values.toarray() if sparse.issparse(values) else np.asarray(values)
        contributions = values[:, :-1]
        expected = model.booster_.predict(sample, raw_score=True)
        reconstructed = values.sum(axis=1)
    if not np.allclose(expected, reconstructed, atol=1e-5, rtol=1e-5):
        raise AssertionError(f"{model_name} contributions do not reconstruct raw model score")
    if contributions.shape[1] != len(feature_names):
        raise AssertionError("Feature contribution width does not match names")
    grouped: dict[str, float] = {}
    means = np.mean(np.abs(contributions), axis=0)
    for feature, value in zip(feature_names, means, strict=True):
        group = feature_group(feature)
        grouped[group] = grouped.get(group, 0.0) + float(value)
    return dict(sorted(grouped.items(), key=lambda item: item[1], reverse=True))


def evaluate(data_dir: Path, artifacts_dir: Path, sample_path: Path) -> dict:
    manifest_path = artifacts_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("test_evaluated") or (artifacts_dir / "model_lab.json").exists():
        raise RuntimeError("Final test results already exist; do not rerun evaluation without a documented new training version")
    rows = read_partition(data_dir / "test.csv")
    y = rows["fraud"].to_numpy(dtype=np.int8)
    transformer = joblib.load(artifacts_dir / "preprocessor.joblib")
    matrix = transformer.transform(model_frame(rows))
    feature_names = manifest["transformed_features"]

    candidates: dict[str, dict] = {}
    selected_importance: dict[str, float] = {}
    for name in ("logistic", "lightgbm"):
        model = joblib.load(artifacts_dir / f"{name}.joblib")
        scores = model.predict_proba(matrix)[:, 1]
        threshold = manifest["validation"][name]["threshold"]
        flags = scores >= threshold
        tn, fp, fn, tp = [int(value) for value in confusion_matrix(y, flags, labels=[0, 1]).ravel()]
        fpr, tpr, _ = roc_curve(y, scores)
        precision, recall, _ = precision_recall_curve(y, scores)
        candidates[name] = {
            "model_id": name,
            "threshold_from_validation": threshold,
            "rows": int(len(y)),
            "fraud_rows": int(y.sum()),
            "prevalence": float(y.mean()),
            "alert_count": int(flags.sum()),
            "alert_rate": float(flags.mean()),
            "precision": float(precision_score(y, flags, zero_division=0)),
            "recall": float(recall_score(y, flags, zero_division=0)),
            "f1": float(f1_score(y, flags, zero_division=0)),
            "average_precision": float(average_precision_score(y, scores)),
            "roc_auc": float(roc_auc_score(y, scores)),
            "confusion": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
            "roc_curve": sampled_points(fpr, tpr),
            "pr_curve": sampled_points(recall[::-1], precision[::-1]),
        }
        if name == manifest["selected_model"]:
            selected_importance = global_importance(name, model, matrix, feature_names)

    sample_path.parent.mkdir(parents=True, exist_ok=True)
    sample_rows = rows.iloc[:2000]
    sample_rows.to_csv(sample_path, index=False, columns=["transaction_id", "step", "merchant", "category", "amount", "fraud"])
    demo_frauds = int(sample_rows["fraud"].sum())
    if demo_frauds == 0:
        raise AssertionError("The chronological demo sample has no fraud rows")

    model_lab = {
        "artifact_version": manifest["artifact_version"],
        "dataset": "BankSim synthetic bank payments",
        "dataset_url": manifest["dataset_source"]["url"],
        "test_period": manifest["split"]["test"],
        "selected_model": manifest["selected_model"],
        "selection_rule": manifest["selection_rule"],
        "candidates": candidates,
        "selected_model_global_importance": selected_importance,
        "importance_definition": "Mean absolute raw-score contribution over the first 2,000 chronological test rows, grouped by source feature; not causal importance",
        "demo_sample": {"file": str(sample_path), "rows": int(len(sample_rows)), "fraud_rows": demo_frauds, "origin": "first 2000 chronological test rows; no score or label selection"},
    }
    (artifacts_dir / "model_lab.json").write_text(json.dumps(model_lab, indent=2) + "\n", encoding="utf-8")
    manifest["test_evaluated"] = True
    manifest["test_results_file"] = "model_lab.json"
    manifest["demo_sample"] = model_lab["demo_sample"]
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return model_lab


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--sample", type=Path, default=Path("data/sample_labeled.csv"))
    args = parser.parse_args()
    result = evaluate(args.data, args.artifacts, args.sample)
    print(json.dumps({"selected_model": result["selected_model"], "demo_sample": result["demo_sample"], "test_metrics": {name: {key: info[key] for key in ("average_precision", "precision", "recall", "f1", "alert_rate")} for name, info in result["candidates"].items()}}, indent=2))


if __name__ == "__main__":
    main()
