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
# Real-target computation from HISTORY rows
# ---------------------------------------------------------------------------

# Min real (non-synthetic) data points required before we accept a record's
# observed CAGR as a real training target. Anything below this falls back to
# NaN (the row gets dropped at train time).
MIN_REAL_POINTS = 4

# Min calendar span (in months) between earliest and latest history points
# required before we trust an observed CAGR. Two adjacent months don't
# annualize meaningfully.
MIN_HISTORY_SPAN_MONTHS = 6

# Cap observed annualized log-returns to a sane band so a single outlier
# set with a 10× pop or a 90% crash doesn't dominate training.
# log(1 + 1.5) ~ 0.916; log(1 - 0.5) ~ -0.693.
MAX_ABS_LOG_RETURN_1Y = 0.916


def _parse_history_row(row: dict) -> tuple[str | None, float | None, str]:
    """Extract (date YYYY-MM-DD, price, source) from a HISTORY DDB row."""
    sk = str(row.get("sk", ""))
    # SK format: "{condition}#{YYYY-MM-DD}" — date is always the last segment.
    date = sk.rsplit("#", 1)[-1] if "#" in sk else sk
    if len(date) < 10:
        return None, None, ""
    price = _to_float(row.get("price"))
    source = str(row.get("source", "")) or "real"
    return date[:10], price, source


def _compute_observed_log_return_1y(history: list[dict]) -> float | None:
    """Compute the trailing annualized log-return from a set's HISTORY rows.

    Approach: sort by date, take the earliest and latest *real* (non-
    synthetic) price points if at least MIN_REAL_POINTS exist across at
    least MIN_HISTORY_SPAN_MONTHS. If too few real points, allow synthetic
    rows to fill the series (down-weighted at the model level via
    sample_weight, not here).

    Returns log(1 + annualized_return), clipped to [-MAX_ABS, +MAX_ABS].
    Returns None if the series is too thin to annualize.
    """
    if not history:
        return None

    parsed: list[tuple[str, float, str]] = []
    for row in history:
        date, price, source = _parse_history_row(row)
        if date and price and price > 0:
            parsed.append((date, price, source))

    if len(parsed) < 2:
        return None

    parsed.sort(key=lambda t: t[0])

    # Prefer real-only series if we have enough; otherwise fall back to all
    # available rows. The caller decides sample_weight.
    real = [p for p in parsed if p[2] not in ("synthetic_backfill",)]
    series = real if len(real) >= MIN_REAL_POINTS else parsed
    if len(series) < 2:
        return None

    earliest_date, earliest_price, _ = series[0]
    latest_date, latest_price, _ = series[-1]
    if earliest_price <= 0 or latest_price <= 0:
        return None

    try:
        e_y, e_m, _ = earliest_date.split("-")[:3] + ["01"][: max(0, 3 - len(earliest_date.split("-")))]
        l_y, l_m, _ = latest_date.split("-")[:3] + ["01"][: max(0, 3 - len(latest_date.split("-")))]
        span_months = (int(l_y) - int(e_y)) * 12 + (int(l_m) - int(e_m))
    except (ValueError, IndexError):
        return None

    if span_months < MIN_HISTORY_SPAN_MONTHS:
        return None

    total_log_return = math.log(latest_price / earliest_price)
    annual_log_return = total_log_return * (12.0 / span_months)
    # Clip to prevent outlier dominance.
    if annual_log_return > MAX_ABS_LOG_RETURN_1Y:
        annual_log_return = MAX_ABS_LOG_RETURN_1Y
    elif annual_log_return < -MAX_ABS_LOG_RETURN_1Y:
        annual_log_return = -MAX_ABS_LOG_RETURN_1Y
    return annual_log_return


def _history_quality_weight(history: list[dict]) -> float:
    """Sample weight for a training row based on how 'real' its history is.

    - 1.0 if all points are real (pricecharting-snapshot / pricecharting-chart)
    - 0.3 if all points are synthetic_backfill
    - linear interpolation otherwise
    """
    if not history:
        return 0.5
    total = 0
    real = 0
    for row in history:
        src = str(row.get("source", "")) or "real"
        if src == "synthetic_backfill":
            total += 1
        else:
            total += 1
            real += 1
    if total == 0:
        return 0.5
    real_frac = real / total
    return 0.3 + 0.7 * real_frac


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_feature_matrix(records: list[dict]) -> pd.DataFrame:
    """Convert raw DDB records to a feature DataFrame.

    Each record is a flat dict with keys from CATALOG / PRICING rows,
    already merged by product_id (the caller handles the join). If the
    caller attaches a ``"history"`` key (list of HISTORY DDB rows for the
    product), real per-set forward-return targets are computed from it.
    Otherwise the row's targets are NaN and it is dropped at train time.

    Returns a DataFrame with one row per record and columns:
      - all feature columns listed in FEATURE_COLUMNS
      - 'product_id' identifier column
      - target columns: target_1y, target_3y, target_5y
        (log-return = ln(1 + observed_annualised_return) × horizon_years,
        derived from HISTORY rows when available; NaN otherwise)
      - 'sample_weight' column reflecting how trustworthy the row's
        target is (1.0 for fully-real history, 0.3 for fully synthetic)
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

        # Real per-set targets derived from HISTORY rows. The caller is
        # responsible for attaching `record["history"]` (a list of HISTORY
        # DDB rows for this product). If unavailable, targets are NaN and
        # the row is dropped at train time.
        history = rec.get("history") or []
        annual_log_return = _compute_observed_log_return_1y(history)
        if annual_log_return is not None and current_price and current_price > 0:
            row["target_1y"] = annual_log_return
            row["target_3y"] = annual_log_return * 3.0
            row["target_5y"] = annual_log_return * 5.0
            row["sample_weight"] = _history_quality_weight(history)
        else:
            for horizon_years in GROWTH_RATES:
                row[f"target_{horizon_years}y"] = float("nan")
            row["sample_weight"] = 0.0

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
