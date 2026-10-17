"""Train offline candidates and select a model using validation data only."""

from __future__ import annotations

import argparse
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import joblib
import lightgbm
import numpy as np
import pandas as pd
import sklearn
from lightgbm import LGBMClassifier
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from features import model_frame


RANDOM_SEED = 42
MAX_ALERT_RATE = 0.05


def read_partition(path: Path) -> pd.DataFrame:
    return pd.read_csv(
        path,
        dtype={"transaction_id": "string", "step": "int16", "merchant": "category", "category": "category", "amount": "float32", "fraud": "int8"},
    )


def threshold_at_workload(y: np.ndarray, scores: np.ndarray) -> dict:
    """Maximize F1 at no more than 5% alerts; tie goes to higher threshold."""
    order = np.argsort(-scores, kind="stable")
    sorted_scores = scores[order]
    sorted_y = y[order]
    cum_tp = np.cumsum(sorted_y)
    n = len(y)
    positives = int(y.sum())
    group_end = np.flatnonzero(np.r_[sorted_scores[:-1] != sorted_scores[1:], True])
    eligible = group_end[(group_end + 1) / n <= MAX_ALERT_RATE]
    if len(eligible) == 0:
        return {"threshold": 1.0, "alert_rate": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0}
    flags = eligible + 1
    tp = cum_tp[eligible]
    precision = tp / flags
    recall = tp / positives if positives else np.zeros_like(tp, dtype=float)
    f1 = np.divide(2 * precision * recall, precision + recall, out=np.zeros_like(precision, dtype=float), where=(precision + recall) > 0)
    best = int(np.argmax(f1))
    idx = int(eligible[best])
    return {
        "threshold": float(sorted_scores[idx]),
        "alert_rate": float(flags[best] / n),
        "precision": float(precision[best]),
        "recall": float(recall[best]),
        "f1": float(f1[best]),
    }


def train(data_dir: Path, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    if (output_dir / "manifest.json").exists() or (output_dir / "model_lab.json").exists():
        raise RuntimeError("Artifacts already exist; use a new output directory and version for retraining")
    split = json.loads((data_dir / "split_manifest.json").read_text(encoding="utf-8"))
    train_rows = read_partition(data_dir / "train.csv")
    val_rows = read_partition(data_dir / "validation.csv")
    x_train = model_frame(train_rows)
    x_val = model_frame(val_rows)
    y_train = train_rows["fraud"].to_numpy(dtype=np.int8)
    y_val = val_rows["fraud"].to_numpy(dtype=np.int8)

    transformer = ColumnTransformer(
        [
            ("numeric", StandardScaler(), ["step", "log_amount"]),
            ("categorical", OneHotEncoder(handle_unknown="ignore", dtype=np.float32), ["merchant", "category"]),
        ],
        sparse_threshold=0.3,
    )
    x_train_transformed = transformer.fit_transform(x_train)
    x_val_transformed = transformer.transform(x_val)

    models = {
        "logistic": LogisticRegression(max_iter=1000, solver="liblinear", random_state=RANDOM_SEED),
        "lightgbm": LGBMClassifier(
            n_estimators=180, num_leaves=15, max_depth=6, learning_rate=0.05,
            min_child_samples=100, subsample=1.0, colsample_bytree=1.0,
            random_state=RANDOM_SEED, n_jobs=2, verbosity=-1,
        ),
    }
    validation: dict[str, dict] = {}
    reference_scores: dict[str, list[float]] = {}
    for name, model in models.items():
        model.fit(x_train_transformed, y_train)
        scores = model.predict_proba(x_val_transformed)[:, 1]
        operating = threshold_at_workload(y_val, scores)
        validation[name] = {"average_precision": float(average_precision_score(y_val, scores)), **operating}
        reference_scores[name] = scores[:5].tolist()
        joblib.dump(model, output_dir / f"{name}.joblib", compress=3)

    baseline = validation["logistic"]
    challenger = validation["lightgbm"]
    choose_lightgbm = (
        challenger["average_precision"] - baseline["average_precision"] >= 0.02
        and challenger["recall"] >= baseline["recall"]
    )
    selected = "lightgbm" if choose_lightgbm else "logistic"
    joblib.dump(transformer, output_dir / "preprocessor.joblib", compress=3)

    manifest = {
        "artifact_version": "banksim-v1-001",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_source": split["source"],
        "split": split["partitions"],
        "model_features": ["step", "log_amount", "merchant", "category"],
        "transformed_features": transformer.get_feature_names_out().tolist(),
        "training_rows": int(len(train_rows)),
        "validation_rows": int(len(val_rows)),
        "validation": validation,
        "validation_reference": {"transaction_ids": val_rows["transaction_id"].iloc[:5].tolist(), "scores": reference_scores},
        "selection_rule": "Use LightGBM only if validation AP improves by >=0.02 absolute and recall at max 5% alert rate is not lower than logistic; otherwise logistic",
        "selected_model": selected,
        "default_threshold": validation[selected]["threshold"],
        "packages": {"python": platform.python_version(), "scikit_learn": sklearn.__version__, "lightgbm": lightgbm.__version__, "pandas": pd.__version__, "numpy": np.__version__},
        "test_evaluated": False,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    manifest = train(args.data, args.output)
    print(json.dumps({"selected_model": manifest["selected_model"], "default_threshold": manifest["default_threshold"], "validation": manifest["validation"]}, indent=2))


if __name__ == "__main__":
    main()
