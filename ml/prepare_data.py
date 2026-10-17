"""Create canonical, chronological BankSim partitions and a small development batch."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from inspect_data import EXPECTED_COLUMNS, file_sha256


CANONICAL_COLUMNS = ("transaction_id", "step", "merchant", "category", "amount", "fraud")
DATASET_URL = "https://www.kaggle.com/datasets/ealaxi/banksim1"
DATASET_LICENSE = "CC-BY-NC-SA-4.0"


def clean_category(value: str) -> str:
    return value.strip().strip("'").strip() or "UNKNOWN"


def find_steps(path: Path) -> list[int]:
    steps: set[int] = set()
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if tuple(reader.fieldnames or ()) != EXPECTED_COLUMNS:
            raise ValueError("BankSim source columns do not match the inspected version")
        for row_number, row in enumerate(reader, start=2):
            try:
                step = int(row["step"])
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid step at CSV row {row_number}") from exc
            if step < 0:
                raise ValueError(f"Negative step at CSV row {row_number}")
            steps.add(step)
    if len(steps) < 5:
        raise ValueError("Too few time steps for a chronological train/validation/test split")
    return sorted(steps)


def split_steps(steps: list[int]) -> dict[str, list[int]]:
    train_end = int(len(steps) * 0.6)
    val_end = train_end + int(len(steps) * 0.2)
    partitions = {
        "train": steps[:train_end],
        "validation": steps[train_end:val_end],
        "test": steps[val_end:],
    }
    if any(not values for values in partitions.values()):
        raise ValueError("A time partition would be empty")
    return partitions


def prepare(source_path: Path, output_dir: Path, sample_path: Path) -> dict:
    steps = find_steps(source_path)
    partitions = split_steps(steps)
    step_to_partition = {
        step: name for name, values in partitions.items() for step in values
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    sample_path.parent.mkdir(parents=True, exist_ok=True)
    counts: dict[str, Counter[str]] = {name: Counter() for name in partitions}
    sample_rows = 0

    paths = {name: output_dir / f"{name}.csv" for name in partitions}
    handles = {name: path.open("w", encoding="utf-8", newline="") for name, path in paths.items()}
    try:
        writers = {name: csv.DictWriter(handle, fieldnames=CANONICAL_COLUMNS) for name, handle in handles.items()}
        for writer in writers.values():
            writer.writeheader()

        with source_path.open("r", encoding="utf-8-sig", newline="") as raw, sample_path.open("w", encoding="utf-8", newline="") as sample_file:
            reader = csv.DictReader(raw)
            sample_writer = csv.DictWriter(sample_file, fieldnames=CANONICAL_COLUMNS)
            sample_writer.writeheader()
            for row_number, row in enumerate(reader, start=2):
                step = int(row["step"])
                label = row["fraud"]
                if label not in {"0", "1"}:
                    raise ValueError(f"Invalid fraud label at CSV row {row_number}")
                try:
                    amount = float(row["amount"])
                except (TypeError, ValueError) as exc:
                    raise ValueError(f"Invalid amount at CSV row {row_number}") from exc
                if amount < 0 or amount != amount or amount == float("inf"):
                    raise ValueError(f"Invalid amount at CSV row {row_number}")

                canonical = {
                    "transaction_id": f"BKS-{row_number - 1:07d}",
                    "step": step,
                    "merchant": clean_category(row["merchant"]),
                    "category": clean_category(row["category"]),
                    "amount": row["amount"].strip(),
                    "fraud": label,
                }
                partition = step_to_partition[step]
                writers[partition].writerow(canonical)
                counts[partition][label] += 1
                if partition == "validation" and sample_rows < 2000:
                    sample_writer.writerow(canonical)
                    sample_rows += 1
    finally:
        for handle in handles.values():
            handle.close()

    manifest = {
        "schema_version": "banksim-v1",
        "source": {"url": DATASET_URL, "file": source_path.name, "sha256": file_sha256(source_path), "license": DATASET_LICENSE},
        "split_method": "chronological by distinct step; source row order retained within each step",
        "partitions": {
            name: {
                "file": str(paths[name]),
                "step_min": min(values),
                "step_max": max(values),
                "distinct_steps": len(values),
                "rows": sum(counts[name].values()),
                "fraud_rows": counts[name]["1"],
                "fraud_rate": counts[name]["1"] / sum(counts[name].values()),
            }
            for name, values in partitions.items()
        },
        "development_sample": {"file": str(sample_path), "rows": sample_rows, "origin": "first 2000 validation rows in source order; no score or label selection"},
    }
    (output_dir / "split_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--sample", type=Path, default=Path("data/sample_dev.csv"))
    args = parser.parse_args()
    print(json.dumps(prepare(args.input, args.output, args.sample), indent=2))


if __name__ == "__main__":
    main()
