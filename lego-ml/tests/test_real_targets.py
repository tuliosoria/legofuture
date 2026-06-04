"""Tests for real-target computation in extract_features.

These verify the Bug 1 fix: training targets are derived from real HISTORY
DDB rows per-set, so the model produces per-set variance instead of a
constant ~10%/yr output.

Run from repo root:
    cd lego-ml && python -m pytest tests/test_real_targets.py -v
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from extract_features import (  # noqa: E402
    MAX_ABS_LOG_RETURN_1Y,
    MIN_HISTORY_SPAN_MONTHS,
    MIN_REAL_POINTS,
    _compute_observed_log_return_1y,
    _history_quality_weight,
    build_feature_matrix,
)


def _h(date: str, price: float, source: str = "pricecharting-snapshot") -> dict:
    return {"sk": f"new-sealed#{date}", "price": price, "source": source}


# ---------------------------------------------------------------------------
# _compute_observed_log_return_1y
# ---------------------------------------------------------------------------

def test_returns_none_for_empty_history():
    assert _compute_observed_log_return_1y([]) is None


def test_returns_none_when_only_one_point():
    assert _compute_observed_log_return_1y([_h("2025-01-01", 100)]) is None


def test_returns_none_when_span_below_min_months():
    # Two points only 3 months apart — too short to annualize.
    history = [_h("2025-01-01", 100), _h("2025-04-01", 110)]
    assert _compute_observed_log_return_1y(history) is None


def test_computes_annualised_log_return_over_real_series():
    # 12-month span: 100 → 121 = +21% over 12mo → log(1.21) ≈ 0.1906
    history = [_h(f"2025-{m:02d}-01", 100 * (1.21 ** (m / 12))) for m in range(1, 13)]
    history.append(_h("2026-01-01", 121.0))
    result = _compute_observed_log_return_1y(history)
    assert result is not None
    assert abs(result - math.log(1.21)) < 0.02


def test_clips_extreme_positive_returns():
    # 100 → 10000 in 12mo would imply log(100) = 4.6 — must be clipped.
    history = [_h("2025-01-01", 100), _h("2026-01-01", 10000)]
    result = _compute_observed_log_return_1y(history)
    assert result is not None
    assert result == MAX_ABS_LOG_RETURN_1Y


def test_clips_extreme_negative_returns():
    history = [_h("2025-01-01", 100), _h("2026-01-01", 5)]
    result = _compute_observed_log_return_1y(history)
    assert result is not None
    assert result == -MAX_ABS_LOG_RETURN_1Y


def test_prefers_real_series_when_enough_real_points():
    # Mix synthetic (flat at 100) with real (rising 50→150). The real series
    # has MIN_REAL_POINTS points spanning a year, so synthetic is ignored.
    real_dates = ["2025-01-01", "2025-04-01", "2025-08-01", "2026-01-01"]
    real_prices = [50, 80, 120, 150]
    history = [
        _h(d, p, "pricecharting-snapshot") for d, p in zip(real_dates, real_prices)
    ]
    history += [_h(f"2025-{m:02d}-15", 100, "synthetic_backfill") for m in range(1, 13)]
    result = _compute_observed_log_return_1y(history)
    assert result is not None
    # Pure real series: log(150/50) = log(3) ≈ 1.0986, clipped to MAX
    assert result == MAX_ABS_LOG_RETURN_1Y


def test_falls_back_to_synthetic_when_real_too_sparse():
    # Only 1 real point — must use full series (which includes synthetic)
    history = [_h("2025-01-01", 100, "pricecharting-snapshot")]
    history += [_h(f"2025-{m:02d}-01", 100 + m * 5, "synthetic_backfill") for m in range(2, 13)]
    history.append(_h("2026-01-01", 160, "synthetic_backfill"))
    result = _compute_observed_log_return_1y(history)
    assert result is not None
    # log(160/100) ≈ 0.47, span 12mo → ~0.47
    assert 0.3 < result < 0.6


# ---------------------------------------------------------------------------
# _history_quality_weight
# ---------------------------------------------------------------------------

def test_quality_weight_all_real():
    history = [_h(f"2025-{m:02d}-01", 100, "pricecharting-snapshot") for m in range(1, 7)]
    assert _history_quality_weight(history) == 1.0


def test_quality_weight_all_synthetic():
    history = [_h(f"2025-{m:02d}-01", 100, "synthetic_backfill") for m in range(1, 7)]
    assert abs(_history_quality_weight(history) - 0.3) < 1e-9


def test_quality_weight_half_real():
    history = [_h(f"2025-{m:02d}-01", 100, "pricecharting-snapshot") for m in range(1, 4)]
    history += [_h(f"2025-{m:02d}-15", 100, "synthetic_backfill") for m in range(1, 4)]
    # 0.3 + 0.7 * 0.5 = 0.65
    assert abs(_history_quality_weight(history) - 0.65) < 1e-9


# ---------------------------------------------------------------------------
# build_feature_matrix: end-to-end target generation
# ---------------------------------------------------------------------------

def test_build_matrix_produces_per_set_target_variance():
    """The core regression test for Bug 1: different sets with different
    historical CAGRs must get different targets, not a constant."""
    records = [
        {
            "product_id": "high-growth",
            "newPrice": 200,
            "year": 2020,
            "theme": "Star Wars",
            "pieceCount": 2000,
            "history": [_h("2024-01-01", 100), _h("2026-01-01", 200)],
        },
        {
            "product_id": "flat",
            "newPrice": 100,
            "year": 2020,
            "theme": "City",
            "pieceCount": 500,
            "history": [_h("2024-01-01", 100), _h("2026-01-01", 100)],
        },
        {
            "product_id": "declining",
            "newPrice": 50,
            "year": 2020,
            "theme": "Friends",
            "pieceCount": 300,
            "history": [_h("2024-01-01", 100), _h("2026-01-01", 50)],
        },
    ]
    df = build_feature_matrix(records)
    assert len(df) == 3
    targets = df["target_1y"].tolist()
    # All three should be non-null and meaningfully different.
    assert all(not np.isnan(t) for t in targets)
    assert len(set(round(t, 3) for t in targets)) == 3, f"Targets collapsed: {targets}"
    # High-growth set should have a positive target larger than flat (0).
    high = df[df["product_id"] == "high-growth"]["target_1y"].iloc[0]
    flat = df[df["product_id"] == "flat"]["target_1y"].iloc[0]
    decl = df[df["product_id"] == "declining"]["target_1y"].iloc[0]
    assert high > 0.2
    assert abs(flat) < 0.01
    assert decl < -0.2


def test_build_matrix_records_without_history_get_nan_targets():
    records = [
        {"product_id": "no-hist", "newPrice": 100, "year": 2020, "theme": "City"},
    ]
    df = build_feature_matrix(records)
    assert len(df) == 1
    assert np.isnan(df["target_1y"].iloc[0])
    assert np.isnan(df["target_5y"].iloc[0])
    assert df["sample_weight"].iloc[0] == 0.0


def test_build_matrix_5y_target_scales_with_horizon():
    records = [
        {
            "product_id": "test",
            "newPrice": 100,
            "year": 2020,
            "theme": "Star Wars",
            "history": [_h("2024-01-01", 100), _h("2026-01-01", 121)],
        },
    ]
    df = build_feature_matrix(records)
    t1 = df["target_1y"].iloc[0]
    t3 = df["target_3y"].iloc[0]
    t5 = df["target_5y"].iloc[0]
    assert abs(t3 - 3 * t1) < 1e-9
    assert abs(t5 - 5 * t1) < 1e-9


def test_build_matrix_sample_weight_reflects_history_source():
    records = [
        {
            "product_id": "real",
            "newPrice": 100,
            "year": 2020,
            "history": [_h("2024-01-01", 100, "pricecharting-snapshot"),
                        _h("2026-01-01", 110, "pricecharting-snapshot")],
        },
        {
            "product_id": "synth",
            "newPrice": 100,
            "year": 2020,
            "history": [_h("2024-01-01", 100, "synthetic_backfill"),
                        _h("2026-01-01", 110, "synthetic_backfill")],
        },
    ]
    df = build_feature_matrix(records)
    real_w = df[df["product_id"] == "real"]["sample_weight"].iloc[0]
    synth_w = df[df["product_id"] == "synth"]["sample_weight"].iloc[0]
    assert real_w == 1.0
    assert abs(synth_w - 0.3) < 1e-9
