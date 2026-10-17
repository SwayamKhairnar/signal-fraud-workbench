"""Shared, deterministic feature preparation for offline training and inference."""

from __future__ import annotations

import numpy as np
import pandas as pd


FEATURE_COLUMNS = ("step", "log_amount", "merchant", "category")


def model_frame(rows: pd.DataFrame) -> pd.DataFrame:
    """Convert canonical transaction rows to columns known at scoring time."""
    required = {"step", "amount", "merchant", "category"}
    missing = required - set(rows.columns)
    if missing:
        raise ValueError(f"Missing model columns: {', '.join(sorted(missing))}")
    step = pd.to_numeric(rows["step"], errors="raise").astype(np.float32)
    amount = pd.to_numeric(rows["amount"], errors="raise").astype(np.float32)
    if not np.isfinite(step).all() or not np.isfinite(amount).all() or (step < 0).any() or (amount < 0).any():
        raise ValueError("Step and amount must be finite, nonnegative numbers")
    merchant = rows["merchant"].astype("string").fillna("UNKNOWN").replace("", "UNKNOWN").astype(str)
    category = rows["category"].astype("string").fillna("UNKNOWN").replace("", "UNKNOWN").astype(str)
    return pd.DataFrame({
        "step": step,
        "log_amount": np.log1p(amount),
        "merchant": merchant,
        "category": category,
    }, index=rows.index)
