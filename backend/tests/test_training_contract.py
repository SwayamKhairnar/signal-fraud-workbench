"""Check the saved model and validation decisions without touching final-test rows."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "ml" / "artifacts"


def test_saved_models_reproduce_validation_reference() -> None:
    import sys

    sys.path.insert(0, str(ROOT / "ml"))
    from features import model_frame

    manifest = json.loads((ARTIFACTS / "manifest.json").read_text(encoding="utf-8"))
    reference = manifest["validation_reference"]
    rows = pd.read_csv(ROOT / "data" / "processed" / "validation.csv", nrows=5)
    assert rows["transaction_id"].tolist() == reference["transaction_ids"]
    transformer = joblib.load(ARTIFACTS / "preprocessor.joblib")
    matrix = transformer.transform(model_frame(rows))
    assert transformer.get_feature_names_out().tolist() == manifest["transformed_features"]
    for name in ("logistic", "lightgbm"):
        model = joblib.load(ARTIFACTS / f"{name}.joblib")
        actual = model.predict_proba(matrix)[:, 1]
        np.testing.assert_allclose(actual, reference["scores"][name], rtol=1e-8, atol=1e-10)


def test_selection_rule_is_recorded_and_reproducible() -> None:
    manifest = json.loads((ARTIFACTS / "manifest.json").read_text(encoding="utf-8"))
    baseline = manifest["validation"]["logistic"]
    challenger = manifest["validation"]["lightgbm"]
    expected = "lightgbm" if (
        challenger["average_precision"] - baseline["average_precision"] >= 0.02
        and challenger["recall"] >= baseline["recall"]
    ) else "logistic"
    assert manifest["selected_model"] == expected
    assert manifest["default_threshold"] == manifest["validation"][expected]["threshold"]
    assert manifest["split"]["train"]["step_max"] < manifest["split"]["validation"]["step_min"]
    assert manifest["split"]["validation"]["step_max"] < manifest["split"]["test"]["step_min"]
