"""Tests for extract_features.build_feature_matrix.

Run from repo root:
    cd lego-ml && python -m pytest tests/test_extract_features.py -v
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from extract_features import (
    ERAS,
    THEMES,
    build_feature_matrix,
    feature_columns,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_RECORD = {
    "product_id": "test-001",
    "id": "test-001",
    "releaseYear": 2019,
    "pieceCount": 1024,
    "originalMsrp": 99.99,
    "newPrice": 110.00,
    "cibPrice": 95.00,
    "loosePrice": 70.00,
    "retired": True,
    "retiringSoon": False,
    "theme": "Technic",
    "era": "Modern",
}

MINIMAL_RECORD = {
    "product_id": "min-001",
    "releaseYear": 2022,
    "pieceCount": 500,
    "newPrice": 49.99,
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestBuildFeatureMatrix:
    def test_happy_path_single_record(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 1

    def test_has_all_feature_columns(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        expected = feature_columns()
        for col in expected:
            assert col in df.columns, f"Missing column: {col}"

    def test_era_one_hot_sum_is_one(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        era_cols = [f"era_{e}" for e in ERAS]
        total = df[era_cols].iloc[0].sum()
        assert total == pytest.approx(1.0)

    def test_theme_one_hot_sum_is_one(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        theme_cols = [f"theme_{t}" for t in THEMES]
        total = df[theme_cols].iloc[0].sum()
        assert total == pytest.approx(1.0)

    def test_correct_era_flagged(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        assert df["era_Modern"].iloc[0] == pytest.approx(1.0)
        assert df["era_Classic"].iloc[0] == pytest.approx(0.0)

    def test_correct_theme_flagged(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        assert df["theme_Technic"].iloc[0] == pytest.approx(1.0)
        assert df["theme_City"].iloc[0] == pytest.approx(0.0)

    def test_retired_flag(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        assert df["retired_flag"].iloc[0] == pytest.approx(1.0)

    def test_pieces_log_positive(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        assert df["pieces_log"].iloc[0] == pytest.approx(math.log(1024), rel=1e-5)

    def test_current_price_log(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        assert df["current_price_log"].iloc[0] == pytest.approx(math.log(110.00), rel=1e-5)

    def test_months_since_release_positive(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        assert df["months_since_release"].iloc[0] > 0

    def test_synthetic_targets_present(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        assert "target_1y" in df.columns
        assert "target_3y" in df.columns
        assert "target_5y" in df.columns

    def test_synthetic_targets_match_10_pct_growth(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        # ln(1.10^N) for N=1,3,5
        assert df["target_1y"].iloc[0] == pytest.approx(math.log(1.10), rel=1e-5)
        assert df["target_3y"].iloc[0] == pytest.approx(3 * math.log(1.10), rel=1e-5)
        assert df["target_5y"].iloc[0] == pytest.approx(5 * math.log(1.10), rel=1e-5)

    def test_empty_records_returns_empty_df(self):
        df = build_feature_matrix([])
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 0

    def test_missing_price_sets_targets_nan(self):
        rec = {**MINIMAL_RECORD}
        rec.pop("newPrice", None)
        # No price fields at all
        bad_rec = {"product_id": "no-price-001", "releaseYear": 2020, "pieceCount": 300}
        df = build_feature_matrix([bad_rec])
        assert len(df) == 1
        # Without any price, target should be NaN
        assert math.isnan(df["target_1y"].iloc[0])

    def test_minimal_record_does_not_raise(self):
        df = build_feature_matrix([MINIMAL_RECORD])
        assert len(df) == 1

    def test_unknown_theme_maps_to_other(self):
        rec = {**SAMPLE_RECORD, "theme": "UnknownThemeXYZ"}
        df = build_feature_matrix([rec])
        assert df["theme_Other"].iloc[0] == pytest.approx(1.0)

    def test_price_ratios_computed_correctly(self):
        df = build_feature_matrix([SAMPLE_RECORD])
        # loose/new = 70/110 ≈ 0.636
        assert df["price_loose_to_new_ratio"].iloc[0] == pytest.approx(70 / 110, rel=1e-4)
        assert df["price_cib_to_new_ratio"].iloc[0] == pytest.approx(95 / 110, rel=1e-4)

    def test_multiple_records(self):
        records = [SAMPLE_RECORD, MINIMAL_RECORD]
        df = build_feature_matrix(records)
        assert len(df) == 2


class TestFeatureColumns:
    def test_returns_list_of_strings(self):
        cols = feature_columns()
        assert isinstance(cols, list)
        assert all(isinstance(c, str) for c in cols)

    def test_includes_all_era_columns(self):
        cols = feature_columns()
        for era in ERAS:
            assert f"era_{era}" in cols

    def test_includes_all_theme_columns(self):
        cols = feature_columns()
        for theme in THEMES:
            assert f"theme_{theme}" in cols

    def test_no_target_columns(self):
        cols = feature_columns()
        for col in cols:
            assert not col.startswith("target_"), f"Unexpected target column: {col}"

    def test_deterministic_order(self):
        assert feature_columns() == feature_columns()
