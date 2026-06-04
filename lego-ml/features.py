"""Feature engineering for the LegoFuture XGBoost training pipeline.

Implements spec §7 features from raw DynamoDB rows. Pure functions; the
data-fetching side lives in train.py.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

import numpy as np
import pandas as pd

log = logging.getLogger("lego-ml.features")

# Closed enums mirroring src/lib/types/lego.ts so we always emit the same
# one-hot columns regardless of which sets happen to be present in the
# training corpus.
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

MIN_HISTORY_POINTS = 3

# Synthetic backfill rows (source == "synthetic_backfill", written by
# scripts/synthesise-sparse-history.mjs) are extrapolated from a single
# current-price snapshot using the curated `momentum` string. They let
# the model train on every MVP set instead of only the ~8 with rich
# real history, but they carry no real learning signal — the "future
# price" target derived from them is just an extrapolation of the
# anchor price. So we treat them as a transient bridge:
#   - If a set has >= MIN_REAL_FOR_DROP real rows, the synthetic rows
#     are dropped from the series (real data wins outright).
#   - Otherwise the synthetic rows are retained so the model has any
#     signal at all, but every produced (anchor, target) pair sourced
#     from a synthetic row is effectively weighted by SYNTHETIC_WEIGHT
#     in the sample (we duplicate-and-skip is overkill; we record the
#     intent here for future-callers and rely on the dropping above
#     to gradually delete this code path as real history accumulates).
SYNTHETIC_WEIGHT = 0.4
MIN_REAL_FOR_DROP = 6
SYNTHETIC_SOURCE = "synthetic_backfill"


@dataclass
class RawSet:
    """All raw DDB context needed to compute features + targets for one set."""

    product_id: str
    catalog: dict
    pricing: dict
    history: list[dict] = field(default_factory=list)
    trends: list[dict] = field(default_factory=list)
    community: list[dict] = field(default_factory=list)


def _to_float(v) -> float | None:
    if v is None or v == "":
        return None
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


def _safe_log(v: float | None) -> float:
    if v is None or v <= 0:
        return 0.0
    return float(np.log(v))


def _parse_release_date(catalog: dict) -> datetime | None:
    rd = catalog.get("releaseDate")
    if isinstance(rd, str) and rd:
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y"):
            try:
                return datetime.strptime(rd, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                pass
    ry = _to_float(catalog.get("releaseYear"))
    if ry:
        try:
            return datetime(int(ry), 1, 1, tzinfo=timezone.utc)
        except (TypeError, ValueError):
            return None
    return None


def _months_between(later: datetime, earlier: datetime) -> int:
    return (later.year - earlier.year) * 12 + (later.month - earlier.month)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _trends_features(trends: list[dict], now: datetime) -> tuple[float, float]:
    if not trends:
        return 0.0, 0.0
    pts = sorted(
        (
            (str(t.get("month") or t.get("sk") or ""), _to_float(t.get("value")))
            for t in trends
        ),
        key=lambda x: x[0],
    )
    pts = [(m, v) for m, v in pts if v is not None and m]
    if not pts:
        return 0.0, 0.0
    last6 = pts[-6:]
    last3 = pts[-3:]
    avg3 = float(np.mean([v for _, v in last3])) if last3 else 0.0
    if len(last6) >= 2:
        ys = np.array([v for _, v in last6], dtype=float)
        xs = np.arange(len(ys), dtype=float)
        slope = float(np.polyfit(xs, ys, 1)[0])
    else:
        slope = 0.0
    return avg3, slope


def _community_features(community: list[dict]) -> tuple[float, float]:
    if not community:
        return 0.0, 0.0
    latest = max(
        community,
        key=lambda c: str(c.get("month") or c.get("sk") or ""),
    )
    rating = _to_float(latest.get("rating")) or 0.0
    rc = _to_float(latest.get("reviewCount")) or 0.0
    return rating, rc


def _price_ratios(pricing: dict) -> tuple[float, float]:
    new_p = _to_float(pricing.get("newPrice") or pricing.get("new-price"))
    cib = _to_float(pricing.get("cibPrice") or pricing.get("cib-price"))
    loose = _to_float(pricing.get("loosePrice") or pricing.get("loose-price"))
    if not new_p or new_p <= 0:
        return 0.0, 0.0
    loose_ratio = (loose / new_p) if loose else 0.0
    cib_ratio = (cib / new_p) if cib else 0.0
    return loose_ratio, cib_ratio


def _one_hot(value: str | None, options: Iterable[str], prefix: str) -> dict[str, int]:
    cols = {f"{prefix}_{o}": 0 for o in options}
    if value:
        key = f"{prefix}_{value}"
        if key in cols:
            cols[key] = 1
        else:
            cols[f"{prefix}_Other"] = 1
    return cols


def _history_to_series(history: list[dict]) -> pd.Series:
    # Phase 2 synthetic-backfill bridge: when a set has enough real
    # rows (>= MIN_REAL_FOR_DROP), drop synthetic rows entirely. When
    # it doesn't, keep them so the model has any signal at all — the
    # synthesise script self-deletes these rows once real PriceCharting
    # history overtakes them, so this branch is transient.
    real_rows = [h for h in history if h.get("source") != SYNTHETIC_SOURCE]
    use = history if len(real_rows) < MIN_REAL_FOR_DROP else real_rows

    rows = []
    for h in use:
        d = h.get("date")
        p = _to_float(h.get("price"))
        if not d or p is None:
            continue
        try:
            ts = pd.Timestamp(d)
        except (TypeError, ValueError):
            continue
        rows.append((ts, p))
    if not rows:
        return pd.Series(dtype=float)
    s = pd.Series({ts: p for ts, p in rows}).sort_index()
    return s


def _target_for_horizon(series: pd.Series, anchor: pd.Timestamp, years: int) -> float | None:
    if series.empty:
        return None
    target_ts = anchor + pd.DateOffset(years=years)
    window_lo = target_ts - pd.Timedelta(days=90)
    window_hi = target_ts + pd.Timedelta(days=90)
    in_window = series[(series.index >= window_lo) & (series.index <= window_hi)]
    if in_window.empty:
        return None
    idx = (in_window.index - target_ts).map(lambda td: abs(td.total_seconds()))
    return float(in_window.iloc[int(np.argmin(idx))])


def build_dataset(raw_sets: list[RawSet]) -> tuple[pd.DataFrame, dict]:
    now = _now_utc()
    rows: list[dict] = []
    dropped_history = 0

    for rs in raw_sets:
        series = _history_to_series(rs.history)
        if len(series) < MIN_HISTORY_POINTS:
            dropped_history += 1
            continue

        cutoff = pd.Timestamp(now.replace(tzinfo=None)) - pd.DateOffset(years=1)
        anchors = [ts for ts in series.index if ts <= cutoff]
        if not anchors:
            dropped_history += 1
            continue

        for anchor in anchors:
            feat = _features_at(rs, series, anchor, now)
            feat["target_1yr"] = _target_for_horizon(series, anchor, 1)
            feat["target_3yr"] = _target_for_horizon(series, anchor, 3)
            feat["target_5yr"] = _target_for_horizon(series, anchor, 5)
            feat["product_id"] = rs.product_id
            feat["anchor_date"] = anchor.strftime("%Y-%m-%d")
            rows.append(feat)

    df = pd.DataFrame(rows)
    stats = {
        "total_sets": len(raw_sets),
        "dropped_insufficient_history": dropped_history,
        "rows": len(df),
        "with_target_1yr": int(df["target_1yr"].notna().sum()) if not df.empty else 0,
        "with_target_3yr": int(df["target_3yr"].notna().sum()) if not df.empty else 0,
        "with_target_5yr": int(df["target_5yr"].notna().sum()) if not df.empty else 0,
    }
    log.info(
        "feature build: %d sets in, %d dropped (history<%d or no 1yr anchor), %d rows out",
        stats["total_sets"],
        stats["dropped_insufficient_history"],
        MIN_HISTORY_POINTS,
        stats["rows"],
    )
    return df, stats


def _features_at(
    rs: RawSet, series: pd.Series, anchor: pd.Timestamp, now: datetime
) -> dict:
    catalog = rs.catalog
    pricing = rs.pricing
    release = _parse_release_date(catalog)
    anchor_dt = anchor.to_pydatetime().replace(tzinfo=timezone.utc)

    months_since_release = (
        _months_between(anchor_dt, release) if release else 0
    )
    ret_year = _to_float(catalog.get("retirementYear"))
    if ret_year:
        retire_dt = datetime(int(ret_year), 12, 31, tzinfo=timezone.utc)
        months_to_retirement = _months_between(retire_dt, anchor_dt)
    else:
        months_to_retirement = 0

    pieces = _to_float(catalog.get("pieceCount")) or 0.0

    cur_price = None
    if not series.empty:
        prior = series[series.index <= anchor]
        if not prior.empty:
            cur_price = float(prior.iloc[-1])
    if cur_price is None:
        cur_price = _to_float(pricing.get("newPrice") or pricing.get("new-price"))

    loose_ratio, cib_ratio = _price_ratios(pricing)
    trends_avg, trends_slope = _trends_features(rs.trends, now)
    community_rating, review_count = _community_features(rs.community)

    retired_flag = 1 if bool(catalog.get("retired")) else 0
    retiring_soon_flag = 1 if bool(catalog.get("retiringSoon")) else 0
    theme = catalog.get("theme") or "Other"
    gwp_flag = 1 if theme == "GWP" else 0

    feat: dict = {
        "months_since_release": float(months_since_release),
        "months_to_retirement": float(months_to_retirement),
        "pieces_log": _safe_log(pieces),
        "current_price_log": _safe_log(cur_price),
        "trends_avg_3mo": float(trends_avg),
        "trends_slope_6mo": float(trends_slope),
        "community_rating": float(community_rating),
        "community_review_count": float(review_count),
        "retired_flag": retired_flag,
        "retiring_soon_flag": retiring_soon_flag,
        "gwp_flag": gwp_flag,
        "price_loose_to_new_ratio": float(loose_ratio),
        "price_cib_to_new_ratio": float(cib_ratio),
    }
    feat.update(_one_hot(catalog.get("era"), ERAS, "era"))
    feat.update(_one_hot(theme, THEMES, "theme"))
    return feat


def feature_columns() -> list[str]:
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
