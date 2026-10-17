"""Bounded CSV validation for the BankSim v1 upload contract."""

from __future__ import annotations

import csv
import io
import math
from collections import Counter
from dataclasses import dataclass


MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 20_000
REQUIRED_COLUMNS = ("transaction_id", "step", "merchant", "category", "amount")
OPTIONAL_COLUMNS = ("fraud",)


class BatchValidationError(Exception):
    def __init__(self, code: str, message: str, details: dict | None = None, status_code: int = 422):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code


@dataclass
class ValidatedBatch:
    rows: list[dict]
    labeled: bool
    cleaning: dict


def normalize_code(value: str) -> str:
    return value.strip().strip("'").strip()


def validate_csv(contents: bytes, known_merchants: set[str], known_categories: set[str]) -> ValidatedBatch:
    if len(contents) > MAX_BYTES:
        raise BatchValidationError("file_too_large", "The CSV is larger than the 5 MB upload limit.", {"maximum_bytes": MAX_BYTES}, 413)
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise BatchValidationError("encoding", "Use a UTF-8 encoded CSV file.") from exc

    reader = csv.reader(io.StringIO(text, newline=""), strict=True)
    try:
        header = next(reader)
    except StopIteration as exc:
        raise BatchValidationError("empty_file", "The file is empty. Download the CSV template to see the required columns.") from exc
    except csv.Error as exc:
        raise BatchValidationError("csv_format", "The CSV header could not be read.") from exc
    header = [name.strip() for name in header]
    if len(header) != len(set(header)):
        raise BatchValidationError("duplicate_columns", "The CSV has duplicate column names.")
    missing = [name for name in REQUIRED_COLUMNS if name not in header]
    extra = [name for name in header if name not in REQUIRED_COLUMNS + OPTIONAL_COLUMNS]
    if missing or extra:
        raise BatchValidationError(
            "columns", "The CSV columns do not match the BankSim v1 template.",
            {"missing": missing, "unsupported": extra, "required": list(REQUIRED_COLUMNS), "optional": list(OPTIONAL_COLUMNS)},
        )
    labeled = "fraud" in header
    result: list[dict] = []
    seen_ids: dict[str, dict] = {}
    drop_reasons: Counter[str] = Counter()
    examples: list[dict] = []
    duplicates = 0
    unknown_merchants = 0
    unknown_categories = 0
    input_rows = 0

    try:
        for csv_row_number, values in enumerate(reader, start=2):
            if not values:
                continue
            input_rows += 1
            if input_rows > MAX_ROWS:
                raise BatchValidationError("too_many_rows", "The CSV exceeds the 20,000-row upload limit.", {"maximum_rows": MAX_ROWS}, 413)
            if len(values) != len(header):
                raise BatchValidationError("csv_format", f"CSV row {csv_row_number} has {len(values)} values; the header has {len(header)} columns.", {"row": csv_row_number})
            raw = dict(zip(header, values, strict=True))
            if labeled and raw["fraud"].strip() not in {"0", "1"}:
                raise BatchValidationError("invalid_label", f"CSV row {csv_row_number} has an invalid fraud label. Use 0 or 1 for every row, or remove the fraud column.", {"row": csv_row_number})

            transaction_id = raw["transaction_id"].strip()
            try:
                step = int(raw["step"].strip())
                if step < 0:
                    raise ValueError
            except ValueError:
                step = None
            try:
                amount = float(raw["amount"].strip())
                if amount < 0 or not math.isfinite(amount):
                    raise ValueError
            except ValueError:
                amount = None
            reason = "missing_transaction_id" if not transaction_id else "invalid_step" if step is None else "invalid_amount" if amount is None else None
            if reason:
                drop_reasons[reason] += 1
                if len(examples) < 8:
                    examples.append({"row": csv_row_number, "reason": reason})
                continue

            merchant = normalize_code(raw["merchant"])
            category = normalize_code(raw["category"])
            unknown_merchant = merchant not in known_merchants
            unknown_category = category not in known_categories
            if unknown_merchant:
                merchant = "UNKNOWN"
            if unknown_category:
                category = "UNKNOWN"
            normalized = {
                "transaction_id": transaction_id,
                "step": step,
                "merchant": merchant,
                "category": category,
                "amount": amount,
            }
            if labeled:
                normalized["fraud"] = int(raw["fraud"].strip())
            prior = seen_ids.get(transaction_id)
            if prior is not None:
                if prior != normalized:
                    raise BatchValidationError("conflicting_id", f"Transaction ID {transaction_id!r} appears with conflicting values.", {"row": csv_row_number, "transaction_id": transaction_id})
                duplicates += 1
                continue
            seen_ids[transaction_id] = normalized
            result.append(normalized)
            unknown_merchants += int(unknown_merchant)
            unknown_categories += int(unknown_category)
    except csv.Error as exc:
        raise BatchValidationError("csv_format", "The CSV contains malformed quoting or separators.") from exc

    if not result:
        raise BatchValidationError("no_valid_rows", "No valid transactions remain after cleaning.", {"drop_reasons": dict(drop_reasons)})
    return ValidatedBatch(
        rows=result,
        labeled=labeled,
        cleaning={
            "input_rows": input_rows,
            "valid_rows": len(result),
            "dropped_rows": sum(drop_reasons.values()),
            "duplicate_rows": duplicates,
            "unknown_merchant_rows": unknown_merchants,
            "unknown_category_rows": unknown_categories,
            "drop_reasons": dict(drop_reasons),
            "examples": examples,
        },
    )
