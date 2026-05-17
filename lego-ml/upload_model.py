"""Upload XGBoost JSON-tree model artifacts to DynamoDB.

Chunks the model JSON into ≤350 KB pieces and writes:
  pk = MODEL#FORECAST#<horizon>
  sk = FORECAST#<horizon>#chunk#NNNN  (zero-padded 4-digit index)

Each item:
  { pk, sk, chunkData: <string slice>, chunkIndex: N, totalChunks: T, version: <iso> }

The TypeScript loader in src/lib/db/lego-forecast-models.ts reassembles
them by querying begins_with(sk, "FORECAST#<horizon>#chunk#"), sorting by
chunkIndex, and joining chunkData strings.
"""

from __future__ import annotations

import json
import logging
import math
import os
from datetime import datetime, timezone
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

log = logging.getLogger("lego-ml.upload_model")

CHUNK_BYTES = 350 * 1024  # Stay well under DDB's 400 KB item limit
DEFAULT_TABLE = os.environ.get("DYNAMODB_TABLE", "legofuture-cache")
DEFAULT_REGION = os.environ.get("AWS_REGION", "us-east-1")


def _model_pk(horizon: str) -> str:
    return f"MODEL#FORECAST#{horizon}"


def _chunk_sk(horizon: str, index: int) -> str:
    return f"FORECAST#{horizon}#chunk#{index:04d}"


def _ddb_table(table_name: str, region: str):  # type: ignore[return]
    return boto3.resource("dynamodb", region_name=region).Table(table_name)


def _query_all(table: Any, **kwargs: Any) -> list[dict]:
    out: list[dict] = []
    resp = table.query(**kwargs)
    out.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table.query(ExclusiveStartKey=resp["LastEvaluatedKey"], **kwargs)
        out.extend(resp.get("Items", []))
    return out


def _delete_existing_chunks(table: Any, horizon: str) -> int:
    """Remove all existing chunk items for this horizon before re-uploading."""
    prefix = f"FORECAST#{horizon}#chunk#"
    existing = _query_all(
        table,
        KeyConditionExpression=Key("pk").eq(_model_pk(horizon)) & Key("sk").begins_with(prefix),
    )
    with table.batch_writer() as batch:
        for item in existing:
            batch.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})
    return len(existing)


def upload_to_ddb(
    model_json: str | dict,
    horizon: str,
    table_name: str = DEFAULT_TABLE,
    region: str = DEFAULT_REGION,
) -> dict:
    """Upload a ForecastModel JSON to DynamoDB as chunked items.

    Args:
        model_json: The model as a JSON string or dict (will be serialised).
        horizon:    One of "1y", "3y", "5y".
        table_name: DynamoDB table name.
        region:     AWS region.

    Returns:
        A summary dict: { horizon, version, totalChunks, bytesUploaded }.
    """
    if isinstance(model_json, dict):
        payload = json.dumps(model_json, separators=(",", ":"))
    else:
        payload = model_json

    version = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    chunk_size = CHUNK_BYTES
    total = math.ceil(len(payload.encode("utf-8")) / chunk_size)
    # Chunk by character count (UTF-8 safe approximation — model JSON is ASCII)
    chunks = [payload[i : i + chunk_size] for i in range(0, len(payload), chunk_size)]
    total = len(chunks)

    table = _ddb_table(table_name, region)
    pk = _model_pk(horizon)

    deleted = _delete_existing_chunks(table, horizon)
    if deleted:
        log.info("deleted %d existing chunks for horizon=%s", deleted, horizon)

    with table.batch_writer() as batch:
        for idx, chunk_data in enumerate(chunks):
            batch.put_item(
                Item={
                    "pk": pk,
                    "sk": _chunk_sk(horizon, idx),
                    "chunkData": chunk_data,
                    "chunkIndex": idx,
                    "totalChunks": total,
                    "version": version,
                    "horizon": horizon,
                }
            )

    log.info(
        "uploaded horizon=%s: %d chunks, %d bytes, version=%s",
        horizon, total, len(payload), version,
    )
    return {
        "horizon": horizon,
        "version": version,
        "totalChunks": total,
        "bytesUploaded": len(payload),
    }
