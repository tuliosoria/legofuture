#!/usr/bin/env python3
"""LegoFuture XGBoost training pipeline.

Trains three XGBoost regressors (1yr / 3yr / 5yr price forecasts) on data
read from DynamoDB `legofuture-cache`, serializes them, base64-chunks the
bundle into ≤350 KB pieces, and writes MODEL#lego-ml#CHUNK#<n> rows plus a
MODEL#lego-ml#MANIFEST row. Also writes a META#SYNC_METADATA#<iso> row.

If the corpus is too sparse to train (e.g. no HISTORY rows yet), the script
writes a META#LIMITATIONS#<iso> row and exits 0 — spec §10. No synthetic
data is ever fabricated.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import math
import os
import pickle
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import boto3
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
from features import (  # noqa: E402
    RawSet,
    build_dataset,
    feature_columns,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("lego-ml.train")

TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "legofuture-cache")
REGION = os.environ.get("AWS_REGION", "us-east-1")
CHUNK_BYTES = 350 * 1024
MODEL_PK = "MODEL#lego-ml"
HORIZONS = (1, 3, 5)


def _ddb_table():
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


def _catalog_rows(table) -> list[dict]:
    rows = _query_all(table, KeyConditionExpression=Key("pk").eq("CATALOG"))
    if rows:
        return rows
    return _scan_all(
        table, FilterExpression=Attr("pk").begins_with("CATALOG#PRODUCT#")
    )


def _pricing_rows(table) -> list[dict]:
    rows = _query_all(table, KeyConditionExpression=Key("pk").eq("PRICING"))
    if rows:
        return rows
    return _scan_all(
        table, FilterExpression=Attr("pk").begins_with("PRICING#PRODUCT#")
    )


def _id_from_sk(sk: str) -> str | None:
    if not sk:
        return None
    if sk.startswith("PRODUCT#"):
        return sk.split("#", 1)[1]
    return None


def _id_from_pk(pk: str, prefix: str) -> str | None:
    if not pk or not pk.startswith(prefix):
        return None
    return pk[len(prefix):]


def load_raw_sets(table) -> list[RawSet]:
    catalogs = _catalog_rows(table)
    pricings = _pricing_rows(table)

    def _key(item: dict) -> str | None:
        pid = item.get("id") or item.get("productId")
        if pid:
            return str(pid)
        pid = _id_from_sk(str(item.get("sk", "")))
        if pid:
            return pid
        for prefix in ("CATALOG#PRODUCT#", "PRICING#PRODUCT#"):
            pid = _id_from_pk(str(item.get("pk", "")), prefix)
            if pid:
                return pid
        return None

    cat_by_id = {k: c for c in catalogs if (k := _key(c))}
    price_by_id = {k: p for p in pricings if (k := _key(p))}

    log.info(
        "loaded %d catalog rows, %d pricing rows",
        len(cat_by_id),
        len(price_by_id),
    )

    raw: list[RawSet] = []
    for pid, catalog in cat_by_id.items():
        pricing = price_by_id.get(pid, {})
        history = _load_history(table, pid)
        trends = _load_trends(table, pid)
        community = _load_community(table, pid)
        raw.append(
            RawSet(
                product_id=pid,
                catalog=catalog,
                pricing=pricing,
                history=history,
                trends=trends,
                community=community,
            )
        )
    return raw


def _load_history(table, pid: str) -> list[dict]:
    items = _query_all(
        table, KeyConditionExpression=Key("pk").eq(f"HISTORY#PRODUCT#{pid}")
    )
    out: list[dict] = []
    for it in items:
        sk = str(it.get("sk", ""))
        if "#" in sk:
            condition, date = sk.split("#", 1)
            if condition != "new-sealed":
                continue
        else:
            date = sk
        price = it.get("price")
        if price is None:
            continue
        out.append({"date": date, "price": price})
    return out


def _load_trends(table, pid: str) -> list[dict]:
    items = _query_all(
        table, KeyConditionExpression=Key("pk").eq(f"TRENDS#{pid}")
    )
    return [
        {"month": str(it.get("sk", "")), "value": it.get("value")}
        for it in items
    ]


def _load_community(table, pid: str) -> list[dict]:
    items = _query_all(
        table, KeyConditionExpression=Key("pk").eq(f"COMMUNITY#{pid}")
    )
    return [
        {
            "month": str(it.get("sk", "")),
            "rating": it.get("rating"),
            "reviewCount": it.get("reviewCount"),
        }
        for it in items
    ]


def _train_one(
    df: pd.DataFrame, target_col: str, feature_cols: list[str]
) -> tuple[xgb.XGBRegressor | None, dict | None]:
    sub = df.dropna(subset=[target_col])
    if len(sub) < 4:
        log.warning(
            "skipping %s: only %d labeled rows (need ≥4 for train/test split)",
            target_col,
            len(sub),
        )
        return None, None
    X = sub[feature_cols].astype(float).values
    y = sub[target_col].astype(float).values
    test_frac = 0.2 if len(sub) >= 10 else 1.0 / len(sub)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=test_frac, random_state=42
    )
    model = xgb.XGBRegressor(
        n_estimators=400,
        max_depth=4,
        learning_rate=0.05,
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
    metrics = {
        "rmse": rmse,
        "r2": r2,
        "n_train": int(len(X_tr)),
        "n_test": int(len(X_te)),
    }
    log.info(
        "%s: rmse=%.3f r2=%.3f (train=%d test=%d)",
        target_col, rmse, r2, len(X_tr), len(X_te),
    )
    return model, metrics


def _serialize_models(
    models: dict[str, xgb.XGBRegressor], feature_cols: list[str]
) -> bytes:
    payload: dict = {"feature_cols": feature_cols, "models": {}}
    for horizon, model in models.items():
        buf = io.BytesIO()
        pickle.dump(model, buf)
        payload["models"][horizon] = base64.b64encode(buf.getvalue()).decode("ascii")
    return json.dumps(payload).encode("utf-8")


def _chunk(data_b64: str, size: int) -> list[str]:
    return [data_b64[i : i + size] for i in range(0, len(data_b64), size)]


def _coerce_metrics(metrics: dict[str, dict]) -> dict:
    out: dict[str, dict] = {}
    for k, v in metrics.items():
        if not v:
            continue
        row: dict = {}
        for mk, mv in v.items():
            if isinstance(mv, float):
                if math.isnan(mv) or math.isinf(mv):
                    row[mk] = None
                else:
                    row[mk] = Decimal(str(round(mv, 6)))
            else:
                row[mk] = mv
        out[k] = row
    return out


def publish_models(
    table,
    models: dict[str, xgb.XGBRegressor],
    metrics: dict[str, dict],
    sample_count: int,
    feature_cols: list[str],
) -> tuple[str, int]:
    version = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    blob = _serialize_models(models, feature_cols)
    blob_b64 = base64.b64encode(blob).decode("ascii")
    chunks = _chunk(blob_b64, CHUNK_BYTES)
    total = len(chunks)
    log.info(
        "publishing model bundle: %d bytes raw, %d b64, %d chunk(s)",
        len(blob), len(blob_b64), total,
    )
    existing = _query_all(
        table,
        KeyConditionExpression=Key("pk").eq(MODEL_PK) & Key("sk").begins_with("CHUNK#"),
    )
    for old in existing:
        table.delete_item(Key={"pk": MODEL_PK, "sk": old["sk"]})

    for i, data in enumerate(chunks):
        table.put_item(
            Item={
                "pk": MODEL_PK,
                "sk": f"CHUNK#{i}",
                "n": i,
                "total": total,
                "data": data,
                "version": version,
            }
        )
    table.put_item(
        Item={
            "pk": MODEL_PK,
            "sk": "MANIFEST",
            "version": version,
            "totalChunks": total,
            "metrics": _coerce_metrics(metrics),
            "trainedAt": version,
            "sampleCount": sample_count,
        }
    )
    return version, total


def write_limitations(table, reason: str, stats: dict | None = None) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    item: dict = {
        "pk": "META",
        "sk": f"LIMITATIONS#{ts}",
        "script": "lego-ml-train",
        "reason": reason,
        "createdAt": iso,
    }
    if stats:
        item["stats"] = {
            k: Decimal(str(v))
            for k, v in stats.items()
            if isinstance(v, (int, float))
        }
    table.put_item(Item=item)
    log.warning("wrote META#%s: %s", item["sk"], reason)
    return item["sk"]


def write_sync_metadata(table, samples: int, version: str | None) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    item: dict = {
        "pk": "META",
        "sk": f"SYNC_METADATA#{ts}",
        "script": "lego-ml-train",
        "samples_trained": samples,
        "createdAt": iso,
    }
    if version:
        item["model_version"] = version
    table.put_item(Item=item)
    log.info("wrote META#%s", item["sk"])
    return item["sk"]


def main() -> int:
    log.info(
        "lego-ml training pipeline starting (table=%s region=%s)",
        TABLE_NAME, REGION,
    )
    table = _ddb_table()
    raw_sets = load_raw_sets(table)
    log.info("loaded %d raw sets", len(raw_sets))

    if not raw_sets:
        write_limitations(
            table,
            "No CATALOG rows in DynamoDB — nothing to train on. "
            "Run npm run sync:pricecharting first.",
        )
        write_sync_metadata(table, 0, None)
        return 0

    df, stats = build_dataset(raw_sets)
    log.info("feature stats: %s", stats)

    feature_cols = feature_columns()

    has_any_target = any(
        stats.get(f"with_target_{h}yr", 0) > 0 for h in HORIZONS
    )
    if df.empty or not has_any_target:
        reason = (
            f"Insufficient history for forward-horizon training "
            f"(sets={stats['total_sets']}, "
            f"dropped_for_history={stats['dropped_insufficient_history']}, "
            f"labeled_rows_1yr=0). HISTORY#PRODUCT#* rows are sparse — "
            f"awaiting back-population from PriceCharting CSV before models "
            f"can be trained."
        )
        write_limitations(table, reason, stats)
        write_sync_metadata(table, 0, None)
        log.warning("EXIT 0 — LIMITATIONS written; no labels available.")
        return 0

    models: dict[str, xgb.XGBRegressor] = {}
    metrics: dict[str, dict] = {}
    for h in HORIZONS:
        key = f"{h}yr"
        model, m = _train_one(df, f"target_{h}yr", feature_cols)
        if model is not None and m is not None:
            models[key] = model
            metrics[key] = m

    if not models:
        reason = (
            f"Have {stats['rows']} feature rows but <4 labeled samples per "
            f"horizon — cannot fit any XGBoost regressor. Training deferred."
        )
        write_limitations(table, reason, stats)
        write_sync_metadata(table, stats["rows"], None)
        log.warning("EXIT 0 — LIMITATIONS written; no horizon had enough labels.")
        return 0

    sample_count = int(stats["rows"])
    version, total = publish_models(
        table, models, metrics, sample_count, feature_cols
    )
    write_sync_metadata(table, sample_count, version)

    log.info("==== TRAIN COMPLETE ====")
    log.info(
        "model_version=%s chunks=%d samples=%d",
        version, total, sample_count,
    )
    for k, v in metrics.items():
        log.info(
            "  %s: rmse=%.3f r2=%.3f n_train=%d n_test=%d",
            k, v["rmse"], v["r2"], v["n_train"], v["n_test"],
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
