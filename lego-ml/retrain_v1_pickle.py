#!/usr/bin/env python3
"""LegoFuture incremental retraining pipeline (spec §8).

Loads the latest MODEL#lego-ml#MANIFEST from DynamoDB, finds HISTORY rows
with capturedAt > manifest.trainedAt, and either:

  (a) full-retrains from scratch if delta > 10% sample growth, OR
  (b) warm-starts the existing XGBoost models with the new rows only.

Republishes chunks, bumps MANIFEST.version, and writes a SYNC_METADATA row
with prior_metrics, new_metrics, samples_added, and the action taken.

If no prior MANIFEST exists, delegates to train.py. If no new HISTORY rows
arrived since trainedAt, writes a noop SYNC_METADATA row and exits 0. No
synthetic data is ever fabricated.
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
from boto3.dynamodb.conditions import Key
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")
except Exception:  # pragma: no cover
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
from features import build_dataset, feature_columns  # noqa: E402
import train as train_mod  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("lego-ml.retrain")

TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "legofuture-cache")
REGION = os.environ.get("AWS_REGION", "us-east-1")
CHUNK_BYTES = 350 * 1024
MODEL_PK = "MODEL#lego-ml"
HORIZONS = (1, 3, 5)
MIN_NEW_SAMPLES = 5
FULL_RETRAIN_GROWTH = 0.10  # >10% sample growth triggers full retrain


def _ddb_table():
    return boto3.resource("dynamodb", region_name=REGION).Table(TABLE_NAME)


def _get_manifest(table) -> dict | None:
    resp = table.get_item(Key={"pk": MODEL_PK, "sk": "MANIFEST"})
    return resp.get("Item")


def _load_model_bundle(table) -> dict | None:
    chunks = train_mod._query_all(
        table,
        KeyConditionExpression=Key("pk").eq(MODEL_PK)
        & Key("sk").begins_with("CHUNK#"),
    )
    if not chunks:
        return None
    chunks.sort(key=lambda c: int(c.get("n", c["sk"].split("#", 1)[1])))
    blob_b64 = "".join(str(c["data"]) for c in chunks)
    blob = base64.b64decode(blob_b64)
    payload = json.loads(blob.decode("utf-8"))
    models: dict[str, xgb.XGBRegressor] = {}
    for horizon, b64 in payload.get("models", {}).items():
        models[horizon] = pickle.loads(base64.b64decode(b64))
    return {
        "feature_cols": payload.get("feature_cols", []),
        "models": models,
    }


def _new_history_rows(table, trained_at: str) -> list[dict]:
    items = train_mod._scan_all(
        table,
        FilterExpression=boto3.dynamodb.conditions.Attr("pk").begins_with(
            "HISTORY#PRODUCT#"
        ),
    )
    out: list[dict] = []
    for it in items:
        captured = str(it.get("capturedAt") or it.get("sk") or "")
        if captured and captured > trained_at:
            out.append(it)
    return out


def _warm_start_one(
    df: pd.DataFrame,
    target_col: str,
    feature_cols: list[str],
    prior_model: xgb.XGBRegressor | None,
) -> tuple[xgb.XGBRegressor | None, dict | None]:
    sub = df.dropna(subset=[target_col])
    if len(sub) < 4:
        log.warning(
            "skipping %s warm-start: only %d labeled rows", target_col, len(sub)
        )
        return None, None
    X = sub[feature_cols].astype(float).values
    y = sub[target_col].astype(float).values
    test_frac = 0.2 if len(sub) >= 10 else 1.0 / len(sub)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=test_frac, random_state=42
    )
    model = xgb.XGBRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=1,
        tree_method="hist",
    )
    fit_kwargs: dict = {}
    if prior_model is not None:
        try:
            fit_kwargs["xgb_model"] = prior_model.get_booster()
        except Exception as exc:  # pragma: no cover
            log.warning("could not extract booster for warm-start: %s", exc)
    model.fit(X_tr, y_tr, **fit_kwargs)
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
        "%s warm-start: rmse=%.3f r2=%.3f (train=%d test=%d)",
        target_col, rmse, r2, len(X_tr), len(X_te),
    )
    return model, metrics


def _write_noop_metadata(table, reason: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    item = {
        "pk": "META",
        "sk": f"SYNC_METADATA#{ts}",
        "script": "lego-ml-retrain",
        "action": "noop",
        "reason": reason,
        "createdAt": iso,
    }
    table.put_item(Item=item)
    log.info("wrote META#%s (noop: %s)", item["sk"], reason)
    return item["sk"]


def _write_retrain_metadata(
    table,
    samples_added: int,
    new_metrics: dict,
    prior_metrics: dict,
    action: str,
    version: str,
) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    item = {
        "pk": "META",
        "sk": f"SYNC_METADATA#{ts}",
        "script": "lego-ml-retrain",
        "action": action,
        "samples_added": samples_added,
        "new_metrics": train_mod._coerce_metrics(new_metrics),
        "prior_metrics": train_mod._coerce_metrics(prior_metrics or {}),
        "model_version": version,
        "createdAt": iso,
    }
    table.put_item(Item=item)
    log.info("wrote META#%s (%s)", item["sk"], action)
    return item["sk"]


def _publish_with_version(
    table,
    models: dict[str, xgb.XGBRegressor],
    metrics: dict[str, dict],
    sample_count: int,
    feature_cols: list[str],
    prior_total_chunks: int,
) -> tuple[str, int]:
    version = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    blob = train_mod._serialize_models(models, feature_cols)
    blob_b64 = base64.b64encode(blob).decode("ascii")
    chunks = train_mod._chunk(blob_b64, CHUNK_BYTES)
    total = len(chunks)
    log.info(
        "publishing retrained bundle: %d raw bytes, %d b64, %d chunk(s) "
        "(prior totalChunks=%d)",
        len(blob), len(blob_b64), total, prior_total_chunks,
    )
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
    if prior_total_chunks > total:
        for i in range(total, prior_total_chunks):
            table.delete_item(Key={"pk": MODEL_PK, "sk": f"CHUNK#{i}"})
            log.info("deleted orphan CHUNK#%d", i)
    table.put_item(
        Item={
            "pk": MODEL_PK,
            "sk": "MANIFEST",
            "version": version,
            "totalChunks": total,
            "metrics": train_mod._coerce_metrics(metrics),
            "trainedAt": version,
            "sampleCount": sample_count,
        }
    )
    return version, total


def _metrics_from_manifest(manifest: dict) -> dict:
    out: dict = {}
    raw = manifest.get("metrics") or {}
    for horizon, m in raw.items():
        if not isinstance(m, dict):
            continue
        row: dict = {}
        for k, v in m.items():
            if isinstance(v, Decimal):
                row[k] = float(v)
            else:
                row[k] = v
        out[horizon] = row
    return out


def main() -> int:
    log.info(
        "lego-ml retrain starting (table=%s region=%s)", TABLE_NAME, REGION
    )
    table = _ddb_table()
    manifest = _get_manifest(table)

    if not manifest:
        log.info("No prior model; bootstrapping via train.main()")
        return train_mod.main()

    trained_at = str(manifest.get("trainedAt") or manifest.get("version") or "")
    prior_sample_count = int(manifest.get("sampleCount") or 0)
    prior_total_chunks = int(manifest.get("totalChunks") or 0)
    prior_metrics = _metrics_from_manifest(manifest)
    log.info(
        "prior manifest: version=%s sampleCount=%d totalChunks=%d",
        manifest.get("version"), prior_sample_count, prior_total_chunks,
    )

    new_rows = _new_history_rows(table, trained_at)
    log.info("found %d HISTORY rows newer than %s", len(new_rows), trained_at)

    if not new_rows:
        _write_noop_metadata(table, "no-new-history")
        log.info("No new data; skipping retrain")
        return 0

    if len(new_rows) < MIN_NEW_SAMPLES:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
        iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        table.put_item(
            Item={
                "pk": "META",
                "sk": f"LIMITATIONS#{ts}",
                "script": "lego-ml-retrain",
                "reason": (
                    f"Only {len(new_rows)} new HISTORY rows since {trained_at} "
                    f"(<{MIN_NEW_SAMPLES}); retrain deferred."
                ),
                "createdAt": iso,
            }
        )
        _write_noop_metadata(table, "insufficient-new-samples")
        log.warning("EXIT 0 — fewer than %d new samples", MIN_NEW_SAMPLES)
        return 0

    raw_sets = train_mod.load_raw_sets(table)
    df, stats = build_dataset(raw_sets)
    feature_cols = feature_columns()
    current_samples = int(stats.get("rows", 0))
    samples_added = max(current_samples - prior_sample_count, len(new_rows))
    growth = (
        samples_added / prior_sample_count if prior_sample_count > 0 else 1.0
    )
    log.info(
        "current_samples=%d prior=%d added=%d growth=%.2f%%",
        current_samples, prior_sample_count, samples_added, growth * 100,
    )

    bundle = _load_model_bundle(table)
    prior_models = bundle["models"] if bundle else {}
    prior_feature_cols = bundle["feature_cols"] if bundle else feature_cols
    feature_mismatch = prior_feature_cols and prior_feature_cols != feature_cols

    if growth > FULL_RETRAIN_GROWTH or feature_mismatch or not prior_models:
        action = "full-retrain"
        log.info(
            "action=full-retrain (growth=%.2f%% feature_mismatch=%s "
            "have_prior_models=%s)",
            growth * 100, feature_mismatch, bool(prior_models),
        )
        train_fn = train_mod._train_one
        models: dict[str, xgb.XGBRegressor] = {}
        metrics: dict[str, dict] = {}
        for h in HORIZONS:
            key = f"{h}yr"
            model, m = train_fn(df, f"target_{h}yr", feature_cols)
            if model is not None and m is not None:
                models[key] = model
                metrics[key] = m
    else:
        action = "warm-start"
        log.info("action=warm-start (growth=%.2f%%)", growth * 100)
        models = {}
        metrics = {}
        for h in HORIZONS:
            key = f"{h}yr"
            model, m = _warm_start_one(
                df, f"target_{h}yr", feature_cols, prior_models.get(key)
            )
            if model is not None and m is not None:
                models[key] = model
                metrics[key] = m

    if not models:
        _write_noop_metadata(table, "no-horizon-trainable")
        log.warning("EXIT 0 — no horizon retrained")
        return 0

    version, total = _publish_with_version(
        table, models, metrics, current_samples, feature_cols, prior_total_chunks
    )
    _write_retrain_metadata(
        table, samples_added, metrics, prior_metrics, action, version
    )

    log.info("==== RETRAIN COMPLETE (%s) ====", action)
    log.info("model_version=%s chunks=%d samples=%d", version, total, current_samples)
    for k, v in metrics.items():
        prior = prior_metrics.get(k, {})
        prior_rmse = prior.get("rmse")
        prior_r2 = prior.get("r2")
        log.info(
            "  %s: rmse=%.3f (prior=%s) r2=%.3f (prior=%s)",
            k, v["rmse"],
            f"{prior_rmse:.3f}" if isinstance(prior_rmse, (int, float)) else "n/a",
            v["r2"],
            f"{prior_r2:.3f}" if isinstance(prior_r2, (int, float)) else "n/a",
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
