"""Build validation-only error slices for the public teaching dashboard."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from backend.app.scoring import ScoringService
from ml.features import model_frame


ROOT = Path(__file__).resolve().parents[1]


def counts(frame: pd.DataFrame, threshold: float) -> dict:
    fraud = frame["fraud"].to_numpy(dtype=bool)
    flag = frame["score"].to_numpy() >= threshold
    tp = int(np.count_nonzero(fraud & flag))
    fp = int(np.count_nonzero(~fraud & flag))
    fn = int(np.count_nonzero(fraud & ~flag))
    tn = int(np.count_nonzero(~fraud & ~flag))
    return {
        "rows": len(frame), "fraud": int(fraud.sum()), "alerts": tp + fp,
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "precision": tp / (tp + fp) if tp + fp else 0.0,
        "recall": tp / (tp + fn) if tp + fn else None,
    }


def build(data_path: Path, service: ScoringService) -> dict:
    frame = pd.read_csv(data_path)
    expected = service.manifest["split"]["validation"]
    if len(frame) != expected["rows"] or int(frame["fraud"].sum()) != expected["fraud_rows"]:
        raise ValueError("Validation partition does not match the saved model manifest")
    if frame["step"].min() != expected["step_min"] or frame["step"].max() != expected["step_max"]:
        raise ValueError("Validation simulation days do not match the saved model manifest")

    frame["score"] = service.model.predict_proba(service.preprocessor.transform(model_frame(frame)))[:, 1]
    threshold = service.threshold
    overall = counts(frame, threshold)
    by_category = [
        {"name": str(name), **counts(group, threshold)}
        for name, group in frame.groupby("category", sort=True)
    ]
    by_amount = []
    for interval, group in frame.groupby(pd.qcut(frame["amount"], 5, duplicates="drop"), observed=True, sort=True):
        by_amount.append({
            "name": f"{max(0, interval.left):.2f}–{interval.right:.2f} units",
            "min_amount": float(group["amount"].min()),
            "max_amount": float(group["amount"].max()),
            **counts(group, threshold),
        })
    periods = pd.cut(frame["step"], bins=[107, 119, 131, 143], labels=["Days 108–119", "Days 120–131", "Days 132–143"])
    by_period = [
        {"name": str(name), **counts(group, threshold)}
        for name, group in frame.groupby(periods, observed=True, sort=True)
    ]

    # Points are chosen by alert workload, then recomputed at the actual score
    # threshold so ties do not make the plotted counts disagree with the UI.
    sorted_scores = np.sort(frame["score"].to_numpy())[::-1]
    budgets = [0, .001, .0025, .005, .0075, .01, .015, .02, .03, .05, .075, .1]
    workload = []
    for share in budgets:
        if share == 0:
            point_threshold = 1.0
        else:
            rank = max(1, min(len(sorted_scores), int(round(share * len(sorted_scores)))))
            point_threshold = float(sorted_scores[rank - 1])
        result = counts(frame, point_threshold)
        workload.append({"threshold": point_threshold, "alert_rate": result["alerts"] / len(frame), **result})
    if not any(abs(point["threshold"] - threshold) < 1e-12 for point in workload):
        workload.append({"threshold": threshold, "alert_rate": overall["alerts"] / len(frame), **overall})
    workload.sort(key=lambda point: point["alerts"])

    missed = frame.loc[(frame["fraud"] == 1) & (frame["score"] < threshold)].sort_values("score", ascending=False).head(6)
    missed_examples = [
        {"step": int(row.step), "category": str(row.category), "amount": float(row.amount), "score": float(row.score)}
        for row in missed.itertuples()
    ]

    return {
        "artifact_version": service.manifest["artifact_version"],
        "source": "Validation partition only; simulation days 108–143",
        "threshold": threshold,
        "overall": overall,
        "by_amount": by_amount,
        "by_category": by_category,
        "by_period": by_period,
        "workload": workload,
        "missed_examples": missed_examples,
        "notes": "Synthetic BankSim labels. Slices describe this validation period, not real-bank performance. Small groups are unstable. No final-test rows are used here.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=ROOT / "data/processed/validation.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "ml/artifacts/validation_analysis.json")
    args = parser.parse_args()
    result = build(args.data, ScoringService())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}: {result['overall']['fn']} validation frauds missed")


if __name__ == "__main__":
    main()
