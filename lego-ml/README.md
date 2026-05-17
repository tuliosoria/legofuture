# lego-ml — XGBoost training pipeline

Trains 1-year, 3-year and 5-year sealed-LEGO price forecast models from the
DynamoDB `legofuture-cache` table, serializes them with pickle + base64, and
publishes the bundle to DynamoDB as `MODEL#lego-ml#CHUNK#<n>` rows + a
single `MODEL#lego-ml#MANIFEST` row.

## What it reads

| DDB key                                 | Use                                    |
| --------------------------------------- | -------------------------------------- |
| `pk=CATALOG, sk=PRODUCT#<id>`           | set metadata (theme, pieces, era, …)   |
| `pk=PRICING, sk=PRODUCT#<id>`           | current loose / CIB / new prices       |
| `pk=HISTORY#PRODUCT#<id>`               | monthly price history (targets)        |
| `pk=TRENDS#<id>, sk=<YYYYMM>`           | Google Trends interest-over-time       |
| `pk=COMMUNITY#<id>, sk=<YYYYMM>`        | community ratings + review counts      |

Falls back to `pk=CATALOG#PRODUCT#<id>` / `pk=PRICING#PRODUCT#<id>` if the
writers migrate to that layout.

## What it writes

| DDB key                                       | Body                              |
| --------------------------------------------- | --------------------------------- |
| `pk=MODEL#lego-ml, sk=CHUNK#<n>`              | `{n, total, data, version}`       |
| `pk=MODEL#lego-ml, sk=MANIFEST`               | `{version, totalChunks, metrics, trainedAt, sampleCount}` |
| `pk=META, sk=SYNC_METADATA#<ts>`              | run telemetry                     |
| `pk=META, sk=LIMITATIONS#<ts>` (when bailing) | reason + stats                    |

Chunks are ≤ 350 KB each (well under DDB's 400 KB item cap).

## Features (spec §7)

`months_since_release`, `months_to_retirement`, `era_*` one-hot,
`theme_*` one-hot, `pieces_log`, `current_price_log`, `trends_avg_3mo`,
`trends_slope_6mo`, `community_rating`, `community_review_count`,
`retired_flag`, `retiring_soon_flag`, `gwp_flag` (always 0 — denylisted),
`price_loose_to_new_ratio`, `price_cib_to_new_ratio`.

Rows with `<3` history points (or no history anchor that is ≥1 yr old) are
dropped; the count is logged.

## Targets

Look-ahead price at anchor + 1 / 3 / 5 years (±90 day window), pulled from
the same history series. Multiple anchors per set ⇒ multiple labeled rows.

## Sparse-data behavior

If history is empty for every set (current state at launch), the script
writes a `META#LIMITATIONS#<ts>` row explaining why and exits 0. **No
synthetic data is ever generated.**

## Setup

```bash
cd lego-ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Environment (read from repo root `.env.local` via `python-dotenv`):

- `DYNAMODB_TABLE` — defaults to `legofuture-cache`
- `AWS_REGION`     — defaults to `us-east-1`
- AWS credentials via the default boto3 chain.

## Run

```bash
npm run ml:train
# or directly:
python3 lego-ml/train.py
```

## Verify

```bash
aws dynamodb get-item --table-name legofuture-cache \
  --key '{"pk":{"S":"MODEL#lego-ml"},"sk":{"S":"MANIFEST"}}'
```
