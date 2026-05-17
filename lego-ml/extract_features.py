"""Feature engineering for the Plan B XGBoost JSON-tree training pipeline.

Exports `build_feature_matrix(records)` — a pure function that converts a
list of raw DDB record dicts into a pandas DataFrame with one row per
(set, anchor) pair and columns matching the TypeScript `featureNames` array
in the bundled model JSONs.

Feature columns (mirrors `features.py::feature_columns()`):
  months_since_release, months_to_retirement, pieces_log, current_price_log,
  trends_avg_3mo, trends_slope_6mo, community_rating, community_review_count,
  retired_flag, retiring_soon_flag, gwp_flag,
  price_loose_to_new_ratio, price_cib_to_new_ratio,
  era_{Classic|Modern|Licensed|Premium},
  theme_{Technic|Star Wars|...|Other}

Synthetic targets (current state — no real forward data yet):
  target_1y, target_3y, target_5y = log(currentPrice * 1.10^N)
  These ship a *functional* pipeline; real targets require historical depth.
"""

from __future__ import annotations

import math
import logging
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger("lego-ml.extract_features")

# ---------------------------------------------------------------------------
# Closed enumerations — must match src/lib/types/lego.ts
# ---------------------------------------------------------------------------

ERAS = ["Classic", "Modern", "Licensed", "Premium"]

THEMES = [
    "Technic",
    "Star Wars",
    "Icons",
    "Creator Expert",
    "Ideas",
    "City",
    "Architecture",
    "Botanical",
    "Seasonal",
    "Modular Buildings",
    "Harry Potter",
    "Marvel",
    "DC",
    "Minecraft",
    "Friends",
    "Disney",
    "Speed Champions",
    "Ninjago",
    "GWP",
    "Other",
]

ERA_BY_THEME: dict[str, str] = {
    "Technic": "Modern",
    "Star Wars": "Licensed",
    "Icons": "Modern",
    "Creator Expert": "Modern",
    "Ideas": "Modern",
    "City": "Modern",
    "Architecture": "Modern",
    "Botanical": "Premium",
    "Seasonal": "Modern",
    "Modular Buildings": "Premium",
    "Harry Potter": "Licensed",
    "Marvel": "Licensed",
    "DC": "Licensed",
    "Minecraft": "Licensed",
    "Friends": "Modern",
    "Disney": "Licensed",
    "Speed Champions": "Modern",
    "Ninjago": "Modern",
    "GWP": "Modern",
    "Other": "Modern",
}

GROWTH_RATES = {1: 1.10, 3: 1.10**3, 5: 1.10**5}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_float(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _safe_log(v: float | None) -> float:
    return float(np.log(v)) if v and v > 0 else 0.0


def _now_months() -> float:
    now = datetime.now(timezone.utc)
    return now.year * 12 + now.month


def _release_months(record: dict) -> float | None:
    """Return the release date as (year*12 + month) for age calculations."""
    for field in ("releaseYear", "release_year", "year"):
        val = record.get(field)
        if val is not None:
            try:
                year = int(val)
                if 1980 <= year <= 2100:
                    return year * 12 + 1  # January of release year
            except (TypeError, ValueError):
                pass
    return None


def _retirement_months(record: dict) -> float | None:
    for field in ("retirementYear", "retirement_year"):
        val = record.get(field)
        if val is not None:
            try:
                year = int(val)
                if 1980 <= year <= 2100:
                    return year * 12 + 12
            except (TypeError, ValueError):
                pass
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_feature_matrix(records: list[dict]) -> pd.DataFrame:
    """Convert raw DDB records to a feature DataFrame.

    Each record is a flat dict with keys from CATALOG / PRICING rows,
    already merged by product_id (the caller handles the join).

    Returns a DataFrame with one row per record and columns:
      - all feature columns listed in FEATURE_COLUMNS
      - 'product_id' identifier column
      - synthetic target columns: target_1y, target_3y, target_5y
        (log-return = ln(currentPrice * growthRate^N / currentPrice))
    """
    now_months = _now_months()
    rows: list[dict] = []

    for rec in records:
        release_m = _release_months(rec)
        retirement_m = _retirement_months(rec)

        months_since = (now_months - release_m) if release_m else 0.0
        months_to = (retirement_m - now_months) if retirement_m else 0.0

        new_price = _to_float(rec.get("newPrice") or rec.get("new_price"))
        cib_price = _to_float(rec.get("cibPrice") or rec.get("cib_price"))
        loose_price = _to_float(rec.get("loosePrice") or rec.get("loose_price"))
        msrp = _to_float(rec.get("originalMsrp") or rec.get("original_msrp") or rec.get("msrp"))

        current_price = new_price or cib_price or loose_price or msrp or None
        pieces = _to_float(rec.get("pieceCount") or rec.get("piece_count"))
        retired = bool(rec.get("retired") or rec.get("retired_flag"))
        retiring_soon = bool(rec.get("retiringSoon") or rec.get("retiring_soon"))
        gwp = (msrp == 0.0) if msrp is not None else False

        theme_raw = str(rec.get("theme") or "Other")
        theme = theme_raw if theme_raw in THEMES else "Other"
        era_raw = str(rec.get("era") or ERA_BY_THEME.get(theme, "Modern"))
        era = era_raw if era_raw in ERAS else ERA_BY_THEME.get(theme, "Modern")

        price_loose_ratio = (loose_price / current_price) if (loose_price and current_price and current_price > 0) else 0.0
        price_cib_ratio = (cib_price / current_price) if (cib_price and current_price and current_price > 0) else 0.0

        row: dict = {
            "product_id": str(rec.get("product_id") or rec.get("id") or ""),
            "months_since_release": max(0.0, months_since),
            "months_to_retirement": months_to,
            "pieces_log": _safe_log(pieces),
            "current_price_log": _safe_log(current_price),
            "trends_avg_3mo": _to_float(rec.get("trends_avg_3mo")) or 0.0,
            "trends_slope_6mo": _to_float(rec.get("trends_slope_6mo")) or 0.0,
            "community_rating": _to_float(rec.get("community_rating")) or 0.0,
            "community_review_count": _to_float(rec.get("community_review_count")) or 0.0,
            "retired_flag": 1.0 if retired else 0.0,
            "retiring_soon_flag": 1.0 if retiring_soon else 0.0,
            "gwp_flag": 1.0 if gwp else 0.0,
            "price_loose_to_new_ratio": price_loose_ratio,
            "price_cib_to_new_ratio": price_cib_ratio,
        }

        for e in ERAS:
            row[f"era_{e}"] = 1.0 if e == era else 0.0
        for t in THEMES:
            row[f"theme_{t}"] = 1.0 if t == theme else 0.0

        # Synthetic targets: log-return = ln(growthFactor) since currentPrice cancels
        if current_price and current_price > 0:
            for horizon_years, growth_factor in GROWTH_RATES.items():
                row[f"target_{horizon_years}y"] = math.log(growth_factor)
        else:
            for horizon_years in GROWTH_RATES:
                row[f"target_{horizon_years}y"] = float("nan")

        rows.append(row)

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    return df


def feature_columns() -> list[str]:
    """Return the ordered list of feature column names (no target columns)."""
    base = [
        "months_since_release",
        "months_to_retirement",
        "pieces_log",
        "current_price_log",
        "trends_avg_3mo",
        "trends_slope_6mo",
        "community_rating",
        "community_review_count",
        "retired_flag",
        "retiring_soon_flag",
        "gwp_flag",
        "price_loose_to_new_ratio",
        "price_cib_to_new_ratio",
    ]
    base += [f"era_{e}" for e in ERAS]
    base += [f"theme_{t}" for t in THEMES]
    return base
