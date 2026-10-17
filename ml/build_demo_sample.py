"""Refresh only the deterministic cross-period demo sample; never rescore the final test."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


def build(test_path: Path, artifacts_dir: Path, sample_path: Path) -> dict:
    manifest_path = artifacts_dir / "manifest.json"
    lab_path = artifacts_dir / "model_lab.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    lab = json.loads(lab_path.read_text(encoding="utf-8"))
    if not manifest.get("test_evaluated") or lab["artifact_version"] != manifest["artifact_version"]:
        raise RuntimeError("Saved final-test evaluation is required before refreshing its demo sample")
    rows = pd.read_csv(test_path, dtype={"transaction_id": "string", "step": "int16", "merchant": "category", "category": "category", "amount": "float32", "fraud": "int8"})
    expected = manifest["split"]["test"]
    if len(rows) != expected["rows"] or int(rows["fraud"].sum()) != expected["fraud_rows"]:
        raise RuntimeError("Test partition no longer matches the saved manifest")
    indices = np.linspace(0, len(rows) - 1, num=min(2000, len(rows)), dtype=int)
    sample = rows.iloc[indices]
    metadata = {
        "file": str(sample_path), "rows": int(len(sample)), "fraud_rows": int(sample["fraud"].sum()),
        "origin": "2000 evenly spaced chronological test positions across all test days; no score or label selection",
    }
    if metadata["fraud_rows"] == 0:
        raise RuntimeError("Demo sample has no fraud labels")
    sample_path.parent.mkdir(parents=True, exist_ok=True)
    sample.to_csv(sample_path, index=False, lineterminator="\n", columns=["transaction_id", "step", "merchant", "category", "amount", "fraud"])
    manifest["demo_sample"] = metadata
    lab["demo_sample"] = metadata
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    lab_path.write_text(json.dumps(lab, indent=2) + "\n", encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test", type=Path, default=Path("data/processed/test.csv"))
    parser.add_argument("--artifacts", type=Path, default=Path("ml/artifacts"))
    parser.add_argument("--sample", type=Path, default=Path("data/sample_labeled.csv"))
    args = parser.parse_args()
    print(json.dumps(build(args.test, args.artifacts, args.sample), indent=2))


if __name__ == "__main__":
    main()
