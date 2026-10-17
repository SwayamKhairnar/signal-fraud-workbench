"""Profile the original BankSim CSV without loading it all into memory."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path


EXPECTED_COLUMNS = (
    "step", "customer", "age", "gender", "zipcodeOri", "merchant",
    "zipMerchant", "category", "amount", "fraud",
)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def inspect(path: Path) -> dict:
    labels: Counter[str] = Counter()
    steps: Counter[int] = Counter()
    categories: Counter[str] = Counter()
    merchants: set[str] = set()
    blanks: Counter[str] = Counter()
    invalid_amount_rows: list[int] = []
    fraud_by_step: Counter[int] = Counter()

    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        columns = tuple(reader.fieldnames or ())
        if columns != EXPECTED_COLUMNS:
            raise ValueError(f"Unexpected columns: {columns!r}")

        for row_number, row in enumerate(reader, start=2):
            for name in columns:
                if not (row[name] or "").strip():
                    blanks[name] += 1
            try:
                step = int(row["step"])
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid step at CSV row {row_number}") from exc
            label = row["fraud"]
            if label not in {"0", "1"}:
                raise ValueError(f"Invalid fraud label at CSV row {row_number}")
            try:
                amount = float(row["amount"])
                if amount < 0 or amount != amount or amount == float("inf"):
                    raise ValueError
            except (TypeError, ValueError):
                invalid_amount_rows.append(row_number)

            labels[label] += 1
            steps[step] += 1
            fraud_by_step[step] += int(label)
            categories[row["category"].strip("' ")] += 1
            merchants.add(row["merchant"].strip("' "))

    return {
        "path": str(path),
        "sha256": file_sha256(path),
        "columns": list(columns),
        "rows": sum(labels.values()),
        "labels": dict(sorted(labels.items())),
        "fraud_rate": labels["1"] / sum(labels.values()),
        "step_count": len(steps),
        "step_min": min(steps),
        "step_max": max(steps),
        "fraud_free_steps": sum(count == 0 for count in fraud_by_step.values()),
        "unique_merchants": len(merchants),
        "categories": dict(categories.most_common()),
        "blank_fields": dict(blanks),
        "invalid_amount_rows": invalid_amount_rows[:10],
        "invalid_amount_count": len(invalid_amount_rows),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    profile = inspect(args.input)
    rendered = json.dumps(profile, indent=2, sort_keys=True)
    print(rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
