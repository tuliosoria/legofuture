# LegoFuture — Data Context (MVP)

A single reference for how LegoFuture's data pipeline actually works today: where set data and prices come from, how the ML model is trained, and how forecasts get refreshed in production.

> The MVP launch on 2026-06-03 is driven by a **static 50-set catalog** at `src/lib/data/sets.ts`. The pipeline described below is fully built and dormant — it can be re-wired by swapping page imports from `LEGO_SETS` back to `loadStoredCatalog()`.

---

## 1. What the system produces

For every LEGO set in the catalog the system aims to produce a 5-year sealed-price forecast plus three scenario terminals (bear / base / bull), a composite 0–100 score, a discrete signal (Strong Buy / Buy / Watch / Hold / Sell), and five confidence sub-ratings (outlook, retirement status, community strength, market liquidity, price agreement).

In the MVP launch these values are **hand-curated** in `LEGO_SETS`. The pipeline below was built so that the same fields can later be regenerated automatically from live data.

---

## 2. Data sources

| Source | What it gives us | Script | DynamoDB write target |
|---|---|---|---|
| **PriceCharting** API | New / loose / CIB sealed prices, release date, sales volume | `scripts/sync-pricecharting-to-dynamo.mjs` (+ `sync-pricecharting-csv.mjs`, `scrape-pricecharting-history.mjs`) | `CATALOG` + `PRICING#PRODUCT#<id>` + `HISTORY#PRODUCT#<id>` rows |
| **Rebrickable** catalog | Set metadata: theme, year, piece count, set number | `scripts/sync-rebrickable-catalog.mjs` | Enriches `CATALOG` rows |
| **BrickLink** marketplace | Per-set marketplace URL, secondary-market reference prices | `scripts/sync-bricklink-pricing.mjs` + `validate-bricklink.mjs` | `BRICKLINK#SET#<slug>` |
| **Brickset** | Additional enrichment (themes, sub-themes, release dates) | `scripts/sync-brickset-enrichment.mjs` | Enriches `CATALOG` rows |
| **eBay** sold listings | Recent sold-comp prices, listing volume, dispersion | `scripts/sync-ebay-sold-listings.mjs` + `sync-ebay-comps.mjs` | Used to compute liquidity / price agreement |
| **Google Trends** | Monthly search-interest signal per set | `scripts/sync-google-trends.mjs` | `TRENDS#<setId>` rows, one per `<yyyymm>` |
| **Reddit + forums** | Community-engagement signal (planned) | `scripts/sync-community.mjs` | `COMMUNITY#<setId>` rows, one per `<yyyymm>` |
| **External curated scores** | Editorial overrides + manual candidate flags | `scripts/sync-external-scores.mjs`, `sync-candidates.mjs` | `CATALOG` `curatedScore` field |
| **BrickLink image CDN** | Product photos via `https://img.bricklink.com/ItemImage/SN/0/{setNumber}-1.png` | `scripts/sync-images.mjs` | Image URLs stored on `CATALOG` rows; MVP UI hot-links directly |

All scripts are **idempotent and resumable** — they checkpoint progress to a `META#{SOURCE}_PROGRESS` row in DynamoDB and skip already-synced items on restart. See `scripts/sync-all.sh` for the canonical end-to-end ordering.

---

## 3. Storage

**Single DynamoDB table:** `legofuture-cache` (us-east-1, on-demand billing). Provisioned by `scripts/setup-dynamodb.sh` (`npm run setup:ddb`). All entities live in one table distinguished by `pk` / `sk` composite key. No GSIs.

| `pk` | `sk` | Holds |
|---|---|---|
| `CATALOG` | `PRODUCT#<id>` | Canonical set record (name, theme, msrp, year, status, …) |
| `PRICING` | `PRODUCT#<id>` | Latest PriceCharting snapshot (`newSealed`, `complete`, `loose`, `updatedAt`) |
| `HISTORY#PRODUCT#<id>` | `<YYYY-MM>` | One row per month per set — the time series the ML model trains on |
| `TRENDS#<setId>` | `<yyyymm>` | Monthly Google Trends snapshot |
| `COMMUNITY#<setId>` | `<yyyymm>` | Monthly community score (Reddit + Trends + forum) |
| `BRICKLINK` | `SET#<slug>` | Resolved BrickLink marketplace URL |
| `MODEL#FORECAST#<1y\|3y\|5y>` | `FORECAST#<horizon>#chunk#NNNN` | Trained XGBoost JSON-tree model, split into ≤350 KB chunks |
| `META` | `LAST_SYNC` / `SYNC_METADATA#<ts>` / `LIMITATIONS#<ts>` | Sync timestamps and limitations reports |

Time-bucketed `sk` values (`<yyyymm>`, `<YYYY-MM>`) sort lexicographically so range queries like `pk = HISTORY#PRODUCT#75313 AND sk BETWEEN 2024-01 AND 2024-12` work natively.

Full schema reference: [`docs/ddb-schema.md`](./docs/ddb-schema.md).

---

## 4. Price-history strategy

The ML retrainer needs a real time series per set. Two prongs:

1. **Backfill scrape** — `scripts/scrape-pricecharting-history.mjs` walks PriceCharting product pages and extracts the embedded history-chart JSON, lighting up the model with N months of real history when it succeeds. Best-effort: scrapers break when upstream HTML changes.
2. **Organic snapshot** — every price-sync run also writes a `HISTORY#PRODUCT#<id>` row keyed by `<YYYY-MM>`, capturing today's loose / CIB / new prices. Implemented in `sync-pricecharting-to-dynamo.mjs`, `sync-images.mjs`, and bootstrapped by `scripts/backfill-current-month-history.mjs` (one-off walk over every `PRICING#PRODUCT#*`). Writes are idempotent (`PutCommand` with no condition) so a monthly re-run overwrites the same `<YYYY-MM>` row.

Detail: [`docs/history-strategy.md`](./docs/history-strategy.md).

---

## 5. ML pipeline

### 5.1 Training (Python, `lego-ml/`)

```
DynamoDB CATALOG/PRICING/HISTORY rows
        │
extract_features.py::build_feature_matrix()   ← pure, testable
        │
train.py::XGBRegressor.fit(target=forward_log_return)
        │
XGBoost JSON tree dump (get_dump(dump_format='json'))
        │
upload_model.py::upload_to_ddb()
        │
MODEL#FORECAST#<horizon> / FORECAST#<horizon>#chunk#NNNN  (≤350 KB each)
```

**Algorithm.** XGBoost gradient-boosted trees, three horizon-specific models (1yr / 3yr / 5yr). Each model predicts `log(price_future / price_today)`; the runtime evaluator runs `expm1` to convert back to a dollar price. Log space stabilises training against heavy-tailed targets.

**Features** (`lego-ml/extract_features.py`):

- `months_since_release`, `months_to_retirement`
- `pieces_log`, `current_price_log`
- `trends_avg_3mo`, `trends_slope_6mo`
- `community_rating`, `community_review_count`
- Theme / product-type one-hot encodings

**Current data state.** Training data is sparse (≈71 sets with PC current prices, no historical depth). The bundled placeholder JSONs at `src/lib/db/bundled/lego-forecast-{1y,3y,5y}.json` already encode a ~10%/yr growth assumption, so the system is fully functional at runtime — but real predictive power requires BrickLink / Brickset / eBay syncs to populate `HISTORY#PRODUCT#*` rows with multi-year sequences first.

### 5.2 Retraining cadence

`infra/lego-ml-retrainer/` ships a **container-image AWS Lambda** invoked on an EventBridge schedule (`rate(7 days)` by default — `template.yaml`). The Lambda:

1. Reads all `CATALOG` / `PRICING` / `HISTORY` / `TRENDS` / `COMMUNITY` rows.
2. Runs the same `train.py` pipeline.
3. Writes new `MODEL#FORECAST#<horizon>` chunks back to DynamoDB.
4. Updates `META#LAST_MODEL_TRAIN` with timestamp + sample count.

Local commands: `npm run ml:train`, `npm run ml:retrain`, `npm run infra:build`.

### 5.3 Inference (TypeScript, request-time)

When a page renders a forecast it calls `src/lib/db/lego-forecast-models.ts::loadForecastModel(horizon)` which:

1. `Query`s DDB with `pk = MODEL#FORECAST#<horizon>`, `begins_with(sk, "FORECAST#<horizon>#chunk#")`.
2. Sorts by `chunkIndex`, joins `chunkData` strings, parses as JSON.
3. Falls back to the bundled JSON at `src/lib/db/bundled/lego-forecast-<horizon>.json` if DDB is empty or the chunks fail to parse.
4. The returned model is fed to `src/lib/domain/lego-ml-scoring.ts::scoreModel(features)` which replays the XGBoost trees in pure TS — no Python at runtime.

The resulting `projectedPrice` flows through `src/lib/domain/lego-forecast.ts::computeForecast()` together with heuristic scoring, derived recommendation (`recommendation.ts`), and a confidence cap (`confidence-display.ts`).

---

## 6. How forecasts get refreshed

| Layer | Cadence | Mechanism |
|---|---|---|
| Sync scripts (catalog + pricing + history snapshot) | Manual or scheduled (`npm run sync:all`) | Writes to DDB; checkpoints in `META#{SOURCE}_PROGRESS` |
| ML retrainer | Weekly (`rate(7 days)` EventBridge) | Container Lambda regenerates `MODEL#FORECAST#*` chunks |
| Next.js page cache (ISR) | 1 hour (`revalidate = 3600`) on `/`, `/buying-list`, `/set-forecast`, `/set-forecast/[slug]` | First request after expiry re-runs the page's data fetch + inference; subsequent requests within the window get the cached HTML |
| MVP static catalog | On commit | `src/lib/data/sets.ts` changes ship via git → Amplify rebuild |

In the **MVP launch** only the last row is active — every other layer exists but is unwired from the user-facing pages. To activate live data: swap `import { LEGO_SETS } from "@/lib/data/sets"` in `src/app/set-forecast/page.tsx`, `[slug]/page.tsx`, `/buying-list`, and `/` for the existing `loadStoredCatalog()` / `getProductBySlug()` / `forecastForSet()` calls. The DDB rows, model chunks, and API routes already exist.

---

## 7. APIs (preserved, currently unused by MVP pages)

| Route | Source data | Status |
|---|---|---|
| `GET /api/sets/catalog` | DDB `CATALOG` query | preserved |
| `GET /api/sets/search` | DDB `CATALOG` + filters | preserved |
| `GET /api/sets/forecast?slug=…` | `forecastForSet()` over DDB | preserved |
| `GET /api/sets/history?slug=…` | DDB `HISTORY#PRODUCT#<id>` range query | preserved |
| `GET /api/sets/pricing?slug=…` | DDB `PRICING#PRODUCT#<id>` | preserved |
| `GET /api/sets/top-buys` | Composite-score top N from DDB | preserved |
| `GET /api/sets/bricklink?slug=…` | DDB `BRICKLINK#SET#<slug>` | preserved |
| `POST /api/sets/vote` | User vote write | preserved |
| `GET /api/trends?slug=…` | DDB `TRENDS#<setId>` | preserved |
| `GET /api/health` | Liveness probe | preserved |
| `POST /api/contact` | Console-log forwarder (no email provider yet) | new for MVP |

All endpoints under `/api/sets/*` continue to work and read from the live DDB layer. The MVP pages just don't import them.

---

## 8. Environment variables (data pipeline)

```
# Data sources
PRICECHARTING_API_TOKEN=
REBRICKABLE_API_KEY=
BRICKLINK_CONSUMER_KEY=
BRICKLINK_CONSUMER_SECRET=
BRICKLINK_TOKEN_VALUE=
BRICKLINK_TOKEN_SECRET=
BRICKSET_API_KEY=
EBAY_APP_ID=
GOOGLE_TRENDS_PROXY_URL=          # optional; otherwise public unauthenticated

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
DYNAMODB_TABLE=legofuture-cache

# MVP surface
NEXT_PUBLIC_EBAY_CAMPAIGN_ID=     # eBay Partner Network campaign id for affiliate links
CONTACT_EMAIL=                    # where /api/contact will forward when wired
```

See `.env.example` for the canonical list.

---

## 9. What's NOT in production yet

- **No live ML inference on the MVP pages.** The 50-set catalog ships hand-curated `proj5y` / `bear` / `bull` / `score` / `signal` values. The XGBoost model exists in `lego-ml/` and the retrainer exists in `infra/`, but the user-facing pages don't currently call them.
- **No email delivery from `/api/contact`** — submissions are `console.log`'d only.
- **Sparse history.** Most sets have ≤1 monthly history row. The model trains on a synthetic `currentPrice × 1.10^N` forward target until BrickLink / Brickset / eBay deep-history syncs catch up.
- **No GSIs on DDB.** Every access pattern is a `GetItem` or a `Query` on a known `pk` prefix.

---

## 10. References

- [`docs/ddb-schema.md`](./docs/ddb-schema.md) — full DynamoDB key/value reference
- [`docs/history-strategy.md`](./docs/history-strategy.md) — price-history backfill rationale
- [`lego-ml/README.md`](./lego-ml/README.md) — ML training architecture (Plan B XGBoost JSON pipeline)
- [`infra/lego-ml-retrainer/README.md`](./infra/lego-ml-retrainer/README.md) — Lambda retrainer infra
- [`docs/superpowers/specs/2026-06-03-mvp-rebuild-design.md`](./docs/superpowers/specs/2026-06-03-mvp-rebuild-design.md) — MVP rebuild design + what stays / goes
