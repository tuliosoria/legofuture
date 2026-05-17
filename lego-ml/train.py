#!/usr/bin/env python3
"""LegoFuture Plan B XGBoost JSON-tree training pipeline.

Trains 1yr / 3yr / 5yr price-forecast models, exports XGBoost tree dumps as
JSON (format understood by the TypeScript lego-ml-scoring.ts scorer), and
optionally uploads them to DynamoDB via upload_model.py.

Usage:
    python lego-ml/train.py --horizon 5y --output models/lego-forecast-5y.json
    python lego-ml/train.py --horizon all --output models/ --upload-to-ddb

Environment variables (read from repo-root .env.local via python-dotenv):
    DYNAMODB_TABLE   DynamoDB table name (default: legofuture-cache)
    AWS_REGION       AWS region          (default: us-east-1)
    AWS_PROFILE      (optional) named AWS credentials profile

NOTE: Training data is currently sparse (71 sets with PC current prices, no
historical depth). The models are trained on synthetic forward-return targets
(currentPrice × 1.10^N) until BrickLink/Brickset/eBay syncs provide real
historical price depth.  The bundled placeholder JSONs already encode this
10% growth assumption; real training adds per-set feature signal on top.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import boto3
import numpy as np
import pandas as pd
import xgboost as xgb
from boto3.dynamodb.conditions import Attr, Key
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")
except Exception:  # pragma: no cover
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_features import build_feature_matrix, feature_columns  # noqa: E402
from upload_model import upload_to_ddb  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("lego-ml.train")

TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "legofuture-cache")
REGION = os.environ.get("AWS_REGION", "us-east-1")

HORIZONS = ["1y", "3y", "5y"]
HORIZON_YEARS = {"1y": 1, "3y": 3, "5y": 5}


# ---------------------------------------------------------------------------
# DDB helpers
# ---------------------------------------------------------------------------

def _table():  # type: ignore[return]
    return boto3.resource("dynamodb", region_name=REGION).Table(TABLE_NAME)


def _query_all(table, **kwargs) -> list[dict]:
    out: list[dict] = []
    resp = table.query(**kwargs)
    out.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table.query(ExclusiveStartKey=resp["LastEvaluatedKey"], **kwargs)
        out.extend(resp.get("Items", []))
    return out


def _scan_all(table, **kwargs) -> list[dict]:
    out: list[dict] = []
    resp = table.scan(**kwargs)
    out.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"], **kwargs)
        out.extend(resp.get("Items", []))
    return out


def _load_records(table) -> list[dict]:
    """Load and merge CATALOG + PRICING rows from DDB."""
    catalogs = _query_all(table, KeyConditionExpression=Key("pk").eq("CATALOG"))
    if not catalogs:
        catalogs = _scan_all(table, FilterExpression=Attr("pk").begins_with("CATALOG#PRODUCT#"))

    pricings = _query_all(table, KeyConditionExpression=Key("pk").eq("PRICING"))
    if not pricings:
        pricings = _scan_all(table, FilterExpression=Attr("pk").begins_with("PRICING#PRODUCT#"))

    def _pid(item: dict) -> str | None:
        pid = item.get("id") or item.get("productId")
        if pid:
            return str(pid)
        sk = str(item.get("sk", ""))
        if sk.startswith("PRODUCT#"):
            return sk.split("#", 1)[1]
        pk = str(item.get("pk", ""))
        for prefix in ("CATALOG#PRODUCT#", "PRICING#PRODUCT#"):
            if pk.startswith(prefix):
                return pk[len(prefix):]
        return None

    cat_by_id = {k: c for c in catalogs if (k := _pid(c))}
    price_by_id = {k: p for p in pricings if (k := _pid(p))}
    log.info("loaded %d catalog, %d pricing rows", len(cat_by_id), len(price_by_id))

    merged: list[dict] = []
    for pid, cat in cat_by_id.items():
        rec = {**cat, **(price_by_id.get(pid, {}))}
        rec["product_id"] = pid
        merged.append(rec)
    return merged


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def _train(df: pd.DataFrame, target_col: str) -> tuple[xgb.XGBRegressor | None, dict | None]:
    sub = df.dropna(subset=[target_col])
    if len(sub) < 4:
        log.warning("Skipping %s: only %d labeled rows (need ≥4)", target_col, len(sub))
        return None, None

    feat_cols = feature_columns()
    X = sub[feat_cols].astype(float).fillna(0).values
    y = sub[target_col].astype(float).values

    test_frac = 0.2 if len(sub) >= 10 else 1.0 / len(sub)
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=test_frac, random_state=42)

    model = xgb.XGBRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=1,
        tree_method="hist",
    )
    model.fit(X_tr, y_tr)

    preds = model.predict(X_te)
    rmse = float(math.sqrt(mean_squared_error(y_te, preds)))
    try:
        r2 = float(r2_score(y_te, preds))
    except ValueError:
        r2 = float("nan")

    log.info("%s: rmse=%.4f r2=%.4f (train=%d test=%d)", target_col, rmse, r2, len(X_tr), len(X_te))
    return model, {"rmse": rmse, "r2": r2}


# ---------------------------------------------------------------------------
# JSON-tree export (Plan B format)
# ---------------------------------------------------------------------------

def _export_model_json(model: xgb.XGBRegressor, horizon: str) -> dict:
    """Serialise an XGBRegressor to the ForecastModel JSON format.

    The tree dump is obtained from get_booster().get_dump(dump_format='json'),
    which emits the exact XGBoostTree node shape consumed by lego-ml-scoring.ts.
    """
    booster = model.get_booster()
    raw_dump = booster.get_dump(dump_format="json", with_stats=False)
    trees = [json.loads(t) for t in raw_dump]

    # XGBoost base_score from booster config
    cfg = json.loads(booster.save_config())
    try:
        base_score = float(cfg["learner"]["learner_model_param"]["base_score"])
    except (KeyError, ValueError):
        base_score = 0.5

    feat_cols = feature_columns()
    version = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return {
        "featureNames": feat_cols,
        "baseScore": base_score,
        "trees": trees,
        "horizon": horizon,
        "version": version,
        "trainedAt": version,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Train LEGO XGBoost JSON-tree forecast models")
    parser.add_argument(
        "--horizon",
        choices=HORIZONS + ["all"],
        default="all",
        help="Which horizon to train (default: all)",
    )
    parser.add_argument(
        "--output",
        default="models/",
        help="Output path: directory (for all) or .json file (for single horizon)",
    )
    parser.add_argument(
        "--upload-to-ddb",
        action="store_true",
        help="After training, upload JSON models to DynamoDB",
    )
    parser.add_argument(
        "--use-ddb",
        action="store_true",
        help="Load training data from DynamoDB (default: use DDB if configured)",
    )
    args = parser.parse_args()

    horizons = HORIZONS if args.horizon == "all" else [args.horizon]
    output = Path(args.output)

    # ---- Load & feature-engineer -----------------------------------------
    if args.use_ddb or args.upload_to_ddb:
        log.info("Loading training data from DynamoDB table=%s", TABLE_NAME)
        try:
            table = _table()
            records = _load_records(table)
        except Exception as exc:
            log.error("DDB load failed: %s", exc)
            return 1
    else:
        log.warning(
            "No --use-ddb flag; using empty record list. "
            "Pass --use-ddb to load from DynamoDB."
        )
        records = []

    if not records:
        log.warning("No records loaded; training on empty dataset (synthetic targets only).")

    df = build_feature_matrix(records)
    log.info("Feature matrix: %d rows", len(df))

    # ---- Train per horizon -----------------------------------------------
    results = []
    for hz in horizons:
        target_col = f"target_{hz}"
        model, metrics = _train(df, target_col) if not df.empty else (None, None)

        if model is None:
            log.warning(
                "No trained model for %s (insufficient labeled rows). "
                "Bundled placeholder will be used at runtime.",
                hz,
            )
            continue

        model_json = _export_model_json(model, hz)

        # ---- Write to disk -----------------------------------------------
        if output.suffix == ".json":
            out_path = output
        else:
            output.mkdir(parents=True, exist_ok=True)
            out_path = output / f"lego-forecast-{hz}.json"

        out_path.write_text(json.dumps(model_json, indent=2))
        log.info("Wrote model to %s", out_path)

        # ---- Upload to DDB -----------------------------------------------
        if args.upload_to_ddb:
            result = upload_to_ddb(model_json, hz)
            log.info("DDB upload: %s", result)

        results.append({"horizon": hz, "metrics": metrics, "path": str(out_path)})

    if results:
        log.info("==== TRAINING COMPLETE ====")
        for r in results:
            m = r["metrics"] or {}
            log.info("  %s: rmse=%.4f r2=%.4f  → %s", r["horizon"], m.get("rmse", 0), m.get("r2", 0), r["path"])
    else:
        log.warning("No models trained (likely insufficient labeled data).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
