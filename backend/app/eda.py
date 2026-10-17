"""Small, bounded aggregates returned with each scored batch."""

from __future__ import annotations

from collections import Counter

import numpy as np


def histogram(values: list[float] | np.ndarray, bins: int = 16, log_scale: bool = False) -> list[dict]:
    array = np.asarray(values, dtype=float)
    if log_scale:
        array = np.log1p(array)
    if len(array) == 0:
        return []
    if np.min(array) == np.max(array):
        value = float(np.expm1(array[0]) if log_scale else array[0])
        return [{"from": value, "to": value, "count": int(len(array))}]
    counts, edges = np.histogram(array, bins=bins)
    if log_scale:
        edges = np.expm1(edges)
    return [{"from": float(edges[i]), "to": float(edges[i + 1]), "count": int(counts[i])} for i in range(len(counts))]


def step_activity(steps: list[int]) -> list[dict]:
    counts = Counter(steps)
    ordered = sorted(counts.items())
    if len(ordered) <= 60:
        return [{"from_step": step, "to_step": step, "count": count} for step, count in ordered]
    minimum, maximum = ordered[0][0], ordered[-1][0]
    edges = np.linspace(minimum, maximum + 1, 61, dtype=int)
    edges = np.unique(edges)
    values = np.asarray(steps)
    return [
        {"from_step": int(edges[i]), "to_step": int(edges[i + 1] - 1), "count": int(((values >= edges[i]) & (values < edges[i + 1])).sum())}
        for i in range(len(edges) - 1)
    ]


def summarize(rows: list[dict], scores: np.ndarray, labeled: bool) -> dict:
    categories = Counter(row["category"] for row in rows)
    result = {
        "total_amount": float(sum(row["amount"] for row in rows)),
        "median_amount": float(np.median([row["amount"] for row in rows])),
        "category_counts": [{"category": name, "count": count} for name, count in categories.most_common()],
        "amount_distribution": histogram([row["amount"] for row in rows], log_scale=True),
        "score_distribution": histogram(scores),
        "step_activity": step_activity([row["step"] for row in rows]),
    }
    if labeled:
        fraud_count = sum(row["fraud"] for row in rows)
        result["fraud_count"] = fraud_count
        result["fraud_rate"] = fraud_count / len(rows)
    return result
