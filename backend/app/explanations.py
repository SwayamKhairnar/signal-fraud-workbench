"""Local TreeSHAP-style LightGBM contributions in raw log-odds units."""

from __future__ import annotations

import math

import pandas as pd

from ml.features import model_frame


GROUPS = (
    ("Simulation day", "numeric__step"),
    ("Amount", "numeric__log_amount"),
    ("Merchant", "categorical__merchant_"),
    ("Purchase category", "categorical__category_"),
)


def explain(service, row: dict) -> dict:
    if service.manifest["selected_model"] != "lightgbm":
        raise RuntimeError("Explanation backend only supports the selected LightGBM model")
    matrix = service.preprocessor.transform(model_frame(pd.DataFrame([row])))
    contributions = service.model.booster_.predict(matrix, pred_contrib=True)
    raw = contributions.toarray()[0] if hasattr(contributions, "toarray") else contributions[0]
    names = service.manifest["transformed_features"]
    if len(raw) != len(names) + 1:
        raise RuntimeError("Contribution shape does not match the saved feature schema")
    baseline = float(raw[-1])
    factors = []
    for label, prefix in GROUPS:
        positions = [i for i, name in enumerate(names) if name == prefix or name.startswith(prefix)]
        factors.append({"factor": label, "contribution": float(sum(raw[i] for i in positions))})
    reconstructed = baseline + sum(item["contribution"] for item in factors)
    score = float(service.model.predict_proba(matrix)[0, 1])
    expected = 1 / (1 + math.exp(-reconstructed))
    if not math.isclose(score, expected, rel_tol=1e-5, abs_tol=1e-7):
        raise RuntimeError("Contributions do not reconstruct the selected model score")
    factors.sort(key=lambda item: abs(item["contribution"]), reverse=True)
    return {
        "transaction_id": row["transaction_id"],
        "risk_score": score,
        "baseline_log_odds": baseline,
        "raw_log_odds": reconstructed,
        "factors": factors,
        "unit": "raw model log-odds",
        "interpretation": "Signed model contributions show how features move this score relative to the model baseline. They are not causes of fraud or calibrated real-world probabilities.",
        "model_version": service.manifest["artifact_version"],
    }
