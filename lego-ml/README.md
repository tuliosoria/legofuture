# lego-ml — XGBoost Training Pipeline

Trains LEGO set price forecast models from DynamoDB price history and exports
them as **XGBoost JSON-tree artifacts** consumed by the TypeScript inference
layer (`src/lib/db/lego-forecast-models.ts` + `src/lib/domain/lego-ml-scoring.ts`).

---

## ⚠️ Current Data State

**Training data is sparse (71 sets with PC current prices, no historical depth).**

The bundled placeholder JSONs at `src/lib/db/bundled/lego-forecast-{1y,3y,5y}.json`
already encode a ~10% annual growth assumption so the system is fully functional at
runtime. Real predictive power requires BrickLink/Brickset/eBay syncs to run first
and populate `HISTORY#PRODUCT#*` rows with multi-year price sequences.

---

## Architecture

### Plan B (this pipeline)

```
DynamoDB CATALOG/PRICING rows
        │
extract_features.py::build_feature_matrix()
        │
train.py::XGBRegressor.fit()
        │
XGBoost JSON tree dump (get_dump(dump_format='json'))
        │
upload_model.py::upload_to_ddb()
        │
DynamoDB MODEL#FORECAST#<horizon> / FORECAST#<horizon>#chunk#NNNN
        │
TypeScript: loadForecastModel() → scoreModel() → projectedPrice
```

### v1 (legacy, pickle)

`train_v1_pickle.py` / `retrain_v1_pickle.py` — kept for reference.
These write pickle bundles to `MODEL#lego-ml` and are read by
`src/lib/ml/lego-forecast-models.ts`. The two systems coexist; Plan B
supersedes Plan A for inference once real models are trained.

---

## Files

| File | Purpose |
|------|---------|
| `train.py` | Main entry — `--horizon {1y,3y,5y,all}`, `--output`, `--upload-to-ddb` |
| `extract_features.py` | `build_feature_matrix(records) → pd.DataFrame` (pure, testable) |
| `upload_model.py` | `upload_to_ddb(model_json, horizon, table_name)` — chunks JSON into ≤350 KB DDB items |
| `features.py` | v1 feature engineering (used by train_v1_pickle.py) |
| `train_v1_pickle.py` | v1 pickle-bundle training (legacy) |
| `retrain_v1_pickle.py` | v1 incremental retraining (legacy) |
| `tests/test_extract_features.py` | pytest happy-path tests for extract_features.py |

---

## DynamoDB Keys (Plan B)

| Key | Description |
|-----|-------------|
| `pk=MODEL#FORECAST#1y`, `sk=FORECAST#1y#chunk#NNNN` | 1yr model chunks |
| `pk=MODEL#FORECAST#3y`, `sk=FORECAST#3y#chunk#NNNN` | 3yr model chunks |
| `pk=MODEL#FORECAST#5y`, `sk=FORECAST#5y#chunk#NNNN` | 5yr model chunks |

The TypeScript loader queries `begins_with(sk, "FORECAST#<horizon>#chunk#")`,
sorts by `chunkIndex`, joins `chunkData` strings, and parses as JSON.
Chunks are ≤350 KB (well under DDB's 400 KB item cap).

---

## Features

`months_since_release`, `months_to_retirement`, `pieces_log`, `current_price_log`,
`trends_avg_3mo`, `trends_slope_6mo`, `community_rating`, `community_review_count`,
`retired_flag`, `retiring_soon_flag`, `gwp_flag`,
`price_loose_to_new_ratio`, `price_cib_to_new_ratio`,
`era_{Classic|Modern|Licensed|Premium}`,
`theme_{Technic|Star Wars|Icons|…|Other}`

---

## Targets (current — synthetic)

`target_Ny = ln(1.10^N)` = log-return for 10% compounded annual growth.

These ship a *functional* pipeline; real predictive power requires historical
price data from BrickLink/Brickset/eBay syncs. Once `HISTORY#PRODUCT#*` rows
are populated with multi-year sequences, re-run training to get data-driven targets.

---

## Setup

```bash
cd lego-ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Environment (auto-loaded from repo root `.env.local` via `python-dotenv`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DYNAMODB_TABLE` | `legofuture-cache` | DynamoDB table |
| `AWS_REGION` | `us-east-1` | AWS region |
| `AWS_PROFILE` | _(default chain)_ | Optional named credentials profile |

---

## Run

```bash
# Train all horizons and write JSON to models/
python lego-ml/train.py --horizon all --output models/

# Train 5yr model and upload to DDB
python lego-ml/train.py --horizon 5y --output models/ --use-ddb --upload-to-ddb

# Or via npm
npm run train:lego
```

---

## Test

```bash
cd lego-ml
python -m pytest tests/test_extract_features.py -v
```

---

## Verify DDB upload

```bash
aws dynamodb query \
  --table-name legofuture-cache \
  --key-condition-expression "pk = :pk" \
  --expression-attribute-values '{":pk":{"S":"MODEL#FORECAST#5y"}}'
```
