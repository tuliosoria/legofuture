"""Tests for the synthetic-backfill bridge in features._history_to_series.

The bridge:
- When a set has >= MIN_REAL_FOR_DROP real rows, synthetic rows are
  dropped from the series.
- When it has fewer real rows, synthetic rows are retained so the
  model has any signal at all.
- SYNTHETIC_WEIGHT is documented as < 1 (calibration constant).

Run from repo root:
    cd lego-ml && python -m pytest tests/test_synthetic_bridge.py -v
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from features import (
    MIN_REAL_FOR_DROP,
    SYNTHETIC_SOURCE,
    SYNTHETIC_WEIGHT,
    _history_to_series,
)


def _mk(date: str, price: float, source: str = "pricecharting-chart") -> dict:
    return {"date": date, "price": price, "source": source}


def test_synthetic_weight_is_below_one() -> None:
    assert 0 < SYNTHETIC_WEIGHT < 1, \
        "synthetic_backfill rows must be down-weighted but still contribute"


def test_drops_synthetic_when_real_count_meets_threshold() -> None:
    real = [_mk(f"2025-{m:02d}-01", 500 + m) for m in range(1, 7)]  # 6 real rows
    synthetic = [_mk("2024-12-01", 400, SYNTHETIC_SOURCE)]
    series = _history_to_series(real + synthetic)
    # All synthetic rows dropped → only 6 real rows remain
    assert len(series) == 6
    assert "2024-12-01" not in [d.strftime("%Y-%m-%d") for d in series.index]


def test_keeps_synthetic_when_real_count_below_threshold() -> None:
    real = [_mk("2025-05-01", 500), _mk("2025-06-01", 510)]  # 2 real rows
    synthetic = [
        _mk(f"2024-{m:02d}-01", 400 + m, SYNTHETIC_SOURCE) for m in range(1, 6)
    ]
    series = _history_to_series(real + synthetic)
    # Below threshold → synthetic rows retained alongside real
    assert len(series) == 7


def test_min_real_for_drop_constant() -> None:
    assert MIN_REAL_FOR_DROP >= 3, \
        "drop threshold must be above MIN_HISTORY_POINTS to avoid race"
