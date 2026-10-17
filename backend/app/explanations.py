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


def _plain_english_summary(row: dict, factors: list[dict], score: float) -> str:
    """Return a 2–3 sentence natural-language explanation built from template logic.

    No LLM involved — sentences are assembled from the top contributors using
    signed contribution values and simple magnitude thresholds.
    """
    top = factors[:2] if len(factors) >= 2 else factors

    sentences: list[str] = []

    for item in top:
        factor = item["factor"]
        c = item["contribution"]
        if abs(c) < 0.05:
            continue  # negligible — skip
        direction = "raises" if c > 0 else "lowers"
        magnitude = (
            "strongly" if abs(c) > 0.4 else ("moderately" if abs(c) > 0.15 else "slightly")
        )

        if factor == "Purchase category":
            cat = row.get("category", "").replace("es_", "").replace("_", " ")
            sentences.append(
                f"The purchase category ({cat}) {magnitude} {direction} the model score."
            )
        elif factor == "Amount":
            amt = row.get("amount", 0)
            sentences.append(
                f"The transaction amount ({amt:,.2f} units) {magnitude} {direction} the model score."
            )
        elif factor == "Merchant":
            sentences.append(
                f"The merchant identity {magnitude} {direction} the model score."
            )
        elif factor == "Simulation day":
            sentences.append(
                f"The timing within the simulation period {magnitude} {direction} the model score."
            )

    if not sentences:
        sentences.append("No single feature dominated the model score for this transaction.")

    risk_label = "high" if score >= 0.7 else ("moderate" if score >= 0.35 else "low")
    sentences.append(
        f"Overall the model assigns a {risk_label} risk score of {score * 100:.1f}% to this transaction."
    )
    return " ".join(sentences)


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
        "plain_english_summary": _plain_english_summary(row, factors, score),
        "unit": "raw model log-odds",
        "interpretation": (
            "Signed model contributions show how features move this score relative to the "
            "model baseline. They are not causes of fraud or calibrated real-world probabilities."
        ),
        "model_version": service.manifest["artifact_version"],
    }
