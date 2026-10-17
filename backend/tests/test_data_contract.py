"""Audit the prepared BankSim partitions for leakage and row loss."""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"
MANIFEST = PROCESSED / "split_manifest.json"
EXPECTED_COLUMNS = ["transaction_id", "step", "merchant", "category", "amount", "fraud"]


def test_chronological_partitions_preserve_every_source_row() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    seen_ids: set[str] = set()
    step_sets: dict[str, set[int]] = {}
    total_rows = 0
    total_frauds = 0

    for name in ("train", "validation", "test"):
        path = PROCESSED / f"{name}.csv"
        counts: Counter[str] = Counter()
        steps: set[int] = set()
        with path.open("r", encoding="utf-8", newline="") as source:
            reader = csv.DictReader(source)
            assert reader.fieldnames == EXPECTED_COLUMNS
            for row in reader:
                assert row["transaction_id"] not in seen_ids
                seen_ids.add(row["transaction_id"])
                assert row["fraud"] in {"0", "1"}
                assert row["merchant"] and row["category"]
                assert float(row["amount"]) >= 0
                counts[row["fraud"]] += 1
                steps.add(int(row["step"]))
        details = manifest["partitions"][name]
        assert sum(counts.values()) == details["rows"]
        assert counts["1"] == details["fraud_rows"]
        assert min(steps) == details["step_min"]
        assert max(steps) == details["step_max"]
        step_sets[name] = steps
        total_rows += sum(counts.values())
        total_frauds += counts["1"]

    assert max(step_sets["train"]) < min(step_sets["validation"])
    assert max(step_sets["validation"]) < min(step_sets["test"])
    assert total_rows == 594_643
    assert total_frauds == 7_200


def test_development_sample_comes_from_validation_prefix() -> None:
    with (ROOT / "data" / "sample_dev.csv").open("r", encoding="utf-8", newline="") as source:
        sample = list(csv.DictReader(source))
    with (PROCESSED / "validation.csv").open("r", encoding="utf-8", newline="") as source:
        validation_prefix = list(row for _, row in zip(range(len(sample)), csv.DictReader(source)))
    assert len(sample) == 2_000
    assert sample == validation_prefix
    assert 0 < sum(row["fraud"] == "1" for row in sample) < len(sample)
