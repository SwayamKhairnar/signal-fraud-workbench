"""Load trusted offline artifacts and score canonical transaction rows."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score

from ml.features import model_frame

from .eda import summarize


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "ml" / "artifacts"


class ScoringService:
    def __init__(self, artifact_dir: Path = ARTIFACT_DIR):
        self.manifest = json.loads((artifact_dir / "manifest.json").read_text(encoding="utf-8"))
        self.model_lab = json.loads((artifact_dir / "model_lab.json").read_text(encoding="utf-8"))
        self.validation_analysis = json.loads((artifact_dir / "validation_analysis.json").read_text(encoding="utf-8"))
        if self.validation_analysis["artifact_version"] != self.manifest["artifact_version"]:
            raise RuntimeError("Validation analysis version does not match the model manifest")
        self.preprocessor = joblib.load(artifact_dir / "preprocessor.joblib")
        self.model = joblib.load(artifact_dir / f"{self.manifest['selected_model']}.joblib")
        self.merchants = set(map(str, self.preprocessor.named_transformers_["categorical"].categories_[0]))
        self.categories = set(map(str, self.preprocessor.named_transformers_["categorical"].categories_[1]))
        actual_names = self.preprocessor.get_feature_names_out().tolist()
        if actual_names != self.manifest["transformed_features"]:
            raise RuntimeError("Saved preprocessing schema does not match the model manifest")
        self.threshold = float(self.manifest["default_threshold"])

    def score(self, rows: list[dict], labeled: bool, cleaning: dict) -> dict:
        frame = pd.DataFrame(rows)
        matrix = self.preprocessor.transform(model_frame(frame))
        scores = self.model.predict_proba(matrix)[:, 1]
        if len(scores) != len(rows) or not np.isfinite(scores).all():
            raise RuntimeError("Model returned invalid score output")
        scored_rows = [{**row, "risk_score": float(score)} for row, score in zip(rows, scores, strict=True)]
        alerts = int((scores >= self.threshold).sum())
        normalized = json.dumps(rows, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        batch_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        result = {
            "batch_hash": batch_hash,
            "mode": "evaluation" if labeled else "scoring",
            "schema_version": "banksim-v1",
            "model_version": self.manifest["artifact_version"],
            "selected_model": self.manifest["selected_model"],
            "default_threshold": self.threshold,
            "alert_count": alerts,
            "cleaning": cleaning,
            "eda": summarize(rows, scores, labeled),
            "rows": scored_rows,
        }
        if labeled:
            y = np.fromiter((row["fraud"] for row in rows), dtype=np.int8)
            flags = scores >= self.threshold
            tn, fp, fn, tp = [int(value) for value in confusion_matrix(y, flags, labels=[0, 1]).ravel()]
            evaluation = {
                "threshold": self.threshold,
                "precision": float(precision_score(y, flags, zero_division=0)),
                "recall": float(recall_score(y, flags, zero_division=0)),
                "f1": float(f1_score(y, flags, zero_division=0)),
                "confusion": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
            }
            if len(np.unique(y)) == 2:
                evaluation["average_precision"] = float(average_precision_score(y, scores))
                evaluation["roc_auc"] = float(roc_auc_score(y, scores))
            else:
                evaluation["average_precision"] = None
                evaluation["roc_auc"] = None
            result["evaluation"] = evaluation
        return result
