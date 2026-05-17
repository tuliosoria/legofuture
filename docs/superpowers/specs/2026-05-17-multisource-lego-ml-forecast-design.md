# Full LEGO Catalog + Multi-Source ML Forecast Pipeline

**Status:** Design (supersedes 2026-05-17-full-catalog-rebrickable-enrichment-design.md)
**Date:** 2026-05-17
**Scope:** All work needed to (a) populate LegoFuture with virtually every LEGO set ever made and (b) ship a robust ML forecast model that mirrors PokeFuture's architecture (XGBoost trained in Python, JSON-serialized trees, TS runtime walks the trees, monthly GitHub Actions retrain + ship-if-better).

---

## Problem

LegoFuture shows 20 hand-curated sets. The user wants *almost all* LEGO products and ML-driven forecasts of PokeFuture's quality. We have abundant resources (multiple API keys, DDB access, AWS, generous compute/token budget) so the design optimizes for **maximum data and signal** rather than minimum effort.

The prior spec (`2026-05-17-full-catalog-rebrickable-enrichment-design.md`) only got us to ~2,500 sets bounded by PriceCharting's coverage, fixed one ingest bug, and stopped short of the ML pipeline entirely. It also didn't take advantage of the resources now available. This spec replaces it.

## Goals

1. **Coverage** — Rebrickable is the catalog spine; LegoFuture displays every LEGO set with at least one pricing source (~5,000–10,000 sets out of Rebrickable's ~20K). Orphan sets are ingested but hidden by default; "show all sets" toggle reveals them.
2. **Data depth** — every ingested set has metadata from Rebrickable + Brickset, current prices from BrickLink Price Guide + PriceCharting + eBay, and historical aggregates from BrickLink (canonical) + PC chart scrape (supplementary).
3. **Forecast quality** — XGBoost models (1yr / 3yr / 5yr) trained on a feature CSV with 30+ LEGO-specific signals (retirement status, theme licensing, minifig rarity, price-to-MSRP). Beats naive CAGR baseline on RMSE / MAPE on a holdout split.
4. **Continuous improvement** — monthly GitHub Actions cron syncs every source, regenerates training CSV, retrains, backtests, ships-if-better. Drift dashboard exposes per-source freshness + accuracy over time.
5. **UX at scale** — dashboard handles 5,000+ rows without regression; server-side search/filter; per-card confidence band.
6. **Engineering parity** — pipeline, file layout, and model serialization mirror PokeFuture so the team can move between codebases without cognitive switching cost.

## Non-Goals

- **Non-USD pricing.** Single-currency MVP. Multi-region inputs folded to USD via stored FX rates.
- **Per-user portfolios / alerts / watch-lists.**
- **Horizons beyond 5 years.** PF stops at 5yr; we match.
- **Real-time pricing.** Monthly snapshots throughout; eBay-sold aggregated to monthly.
- **LLM-generated forecast rationales.** Confidence band + feature-importance bars only.

## Architecture

```
┌─────────── INGEST (parallel, monthly cron) ───────────┐
│ Rebrickable ─► catalog spine (~20K sets, metadata)    │
│ Brickset    ─► regional RRP history, launch prices    │
│ BrickLink   ─► Price Guide API: 6mo aggregates +      │
│                price_detail[] last-50 transactions    │
│                → monthly historical spine             │
│ PriceChart  ─► current prices + chart scrape          │
│ eBay        ─► Browse + sold listings → monthly       │
│ Google      ─► (existing) trends                      │
│ Reddit/etc. ─► (existing) community score             │
└───────────────────────┬───────────────────────────────┘
                        ▼
┌───────────── DYNAMO (legofuture-cache) ───────────────┐
│ CATALOG#PRODUCT#<setNum>                              │
│ PRICING#PRODUCT#<setNum>                              │
│ HISTORY#PRODUCT#<setNum>  sk=<source>#YYYY-MM         │
│ COMMUNITY#PRODUCT#<setNum>                            │
│ MODEL#FORECAST#<horizon>  (xgboost JSON, chunked)     │
│ META#SYNC#<source>#<ts>                               │
└───────────────────────┬───────────────────────────────┘
                        ▼
┌──── TRAINING (Python, monthly via GitHub Actions) ────┐
│ 1. dump_training_csv.py  DDB → training-dataset.csv   │
│ 2. engineer_features.py  30+ LEGO-specific features   │
│ 3. train_models.py       per-horizon XGBoost          │
│                          (1yr → 3yr → 5yr chained)    │
│ 4. backtest.py           holdout RMSE/MAPE            │
│ 5. publish.py            ship-if-better than baseline │
└───────────────────────┬───────────────────────────────┘
                        ▼
┌──────────────── RUNTIME (Next.js TS) ─────────────────┐
│ loadForecastModelBundle()  reads DDB (TTL cached) or  │
│                            falls back to bundled JSON │
│ scoreForecast(item)        walks XGBoost trees in TS, │
│                            returns prediction + band  │
│                            + top-3 feature importance │
└───────────────────────────────────────────────────────┘
```

## Components

### Phase 1 — Multi-source ingestion (parallel)

Independent npm scripts orchestrated by `scripts/sync-all.sh`. Each runs alone for testing.

**1.1 `scripts/sync-rebrickable-catalog.mjs` (new — catalog spine)**
- Paginate `/api/v3/lego/sets/?page_size=1000` to exhaustion (~20 calls for full catalog).
- Per set: id, name, year, theme_id, num_parts, set_img_url. Resolve theme via cached `/lego/themes/`. Resolve minifig count via `/lego/sets/{n}/minifigs/`.
- Write DDB `CATALOG#PRODUCT#<set_num>` with `enrichmentStatus: "rebrickable-only"`.
- Disk cache at `.cache/rebrickable/`. Cold ~30 min, warm ~2 min.

**1.2 `scripts/sync-brickset-enrichment.mjs` (new)**
- Brickset free API; pulls launch price USD/GBP/EUR/DKK, categories, dimensions, age range.
- Supplements (does not overwrite) Rebrickable fields. 1 req/sec; disk cache; ~5 hours cold.

**1.3 `scripts/sync-bricklink-pricing.mjs` (new — PRIMARY HISTORY SOURCE)**
- OAuth 1.0a. Per set: `GET /catalog/items/SET/{n}-1/price?guide_type=sold&new_or_used={N|U}` + `guide_type=stock` for supply.
- Response includes `price_detail[]` array of last ~50 individual transactions with dates — bucket to monthly aggregates → HISTORY rows with `sk = "bricklink-{condition}#YYYY-MM"`.
- BrickLink is the dominant LEGO secondary market; real transactions, not estimates. ~5 req/sec sustainable.

**1.4 `scripts/sync-pricecharting.mjs` (existing — fix `?platform=lego` bug)**
- Replace with `?q=lego` paginated until 2 consecutive zero-LEGO-result pages.
- Keep rows where `console-name` starts with `"LEGO "`; drop `LEGO Games` console.
- Continue using `scrape-pricecharting-history.mjs` as supplementary history.

**1.5 `scripts/sync-ebay-sold-listings.mjs` (new)**
- eBay Browse + Marketplace Insights (sold API requires app approval; fallback = public sold-search scrape capped at 100 rpm).
- Per set, last 90d completed sales → monthly median + count + stddev → HISTORY `sk = "ebay#YYYY-MM"`.

**1.6/1.7 `sync-google-trends.mjs` + `sync-community.mjs` (existing — extend)**
- Confirm output schema matches feature engineering expectations.
- Extend community scraper to r/lego, r/legodeal, r/lego_raffles. 30-day rolling community-score per set.

**1.8 `scripts/sync-all.sh` (orchestrator)**
- Rebrickable runs first (catalog spine).
- Then Brickset, BrickLink, PriceCharting, eBay, Trends, Community run in parallel.
- Finally PC chart scrape (depends on knowing which PC products exist).

### Phase 2 — Training pipeline (Python, mirrors PokeFuture)

New directory `lego-ml/`:
```
lego-ml/
├── pyproject.toml        # uv-managed
├── requirements.txt      # xgboost, pandas, numpy, boto3, scikit-learn
├── src/
│   ├── dump_training_csv.py
│   ├── engineer_features.py
│   ├── train_models.py
│   ├── backtest.py
│   └── publish.py
├── data/training-dataset.csv    # generated, gitignored
├── models/{model-1yr,model-3yr,model-5yr,training-summary}.json
└── tests/{test_engineer_features,test_backtest}.py
```

**2.1 Features (30+ columns, LEGO-specific):**

| # | Feature | Source |
|---|---|---|
| 1 | `current_price` | BrickLink avg new+used |
| 2 | `log_current_price` | log |
| 3 | `original_msrp_usd` | Brickset / Rebrickable |
| 4 | `price_to_msrp_ratio` | current / msrp |
| 5 | `set_age_years` | now - release_year |
| 6 | `retired` | Rebrickable + heuristic |
| 7 | `days_since_retired` | when known |
| 8 | `piece_count` | Rebrickable |
| 9 | `minifig_count` | Rebrickable |
| 10 | `price_per_piece` | current / pieces |
| 11 | `price_per_piece_z_in_theme` | z-score within theme |
| 12-13 | `theme_encoded`, `subtheme_encoded` | label-encoded |
| 14 | `is_licensed` | Star Wars / Marvel / HP / Disney / etc. |
| 15 | `theme_median_3yr_return` | per-theme baseline |
| 16-20 | BrickLink supply/demand: `qty_for_sale`, `qty_sold_6mo`, `supply_demand_ratio`, `avg_price_used`, `avg_price_new` |
| 21 | `provider_spread_pct` | (PC - BrickLink) / mean |
| 22 | `provider_agreement_score` | inverse stddev across sources |
| 23-25 | `price_momentum_{1,6,12}mo` | rolling |
| 26 | `price_volatility_6mo` | rolling stddev |
| 27 | `drawdown_12mo` | (peak - trough) / peak |
| 28 | `history_density_12mo` | non-null months in last 12 |
| 29-30 | `google_trends_12mo_avg`, `google_trends_momentum` | |
| 31-32 | `community_score`, `reddit_mentions_12mo` | |
| 33 | `era_encoded` | pre-2000 / 2000s / 2010s / 2020s |
| 34 | `oof_pred_1yr` | (3yr + 5yr models only) chained |
| 35 | `oof_pred_3yr` | (5yr model only) |

Snapshot frequency: monthly. Each set contributes one training row per snapshot. Targets: `price_{1,3,5}yr_later` (forward-looking from history). Sets without enough forward history train on shorter horizons only.

**2.2 Training sequence:**
```
python -m src.dump_training_csv
python -m src.engineer_features
python -m src.train_models --horizon 1yr
python -m src.train_models --horizon 3yr  # uses oof_pred_1yr
python -m src.train_models --horizon 5yr  # uses oof_pred_1yr + oof_pred_3yr
python -m src.backtest
python -m src.publish    # ship only if RMSE ≥1% better than current
```

**2.3 Serialization:** `booster.dump_model(dump_format='json')` → JSON tree array, same shape as PokeFuture's `model-5yr.json`. Bundle into `src/lib/data/lego-ml/` AND write chunked into DDB `MODEL#FORECAST#<horizon>` for hot-swap without redeploy.

### Phase 3 — Runtime inference (TypeScript, mirrors PokeFuture)

**3.1 `src/lib/db/lego-forecast-models.ts`** — copy PokeFuture's `sealed-forecast-models.ts` verbatim with type renames. `loadForecastModelBundle()` with TTL cache; bundled-JSON fallback.

**3.2 `src/lib/domain/lego-forecast-ml.ts`** — tree-walking inference for XGBoost JSON. Copy PokeFuture's `sealed-forecast-ml.ts`.

**3.3 `src/lib/domain/lego-forecast.ts` (replace existing CAGR formula)** — build feature vector → call ML model per horizon → compute confidence band from per-bucket RMSE → return Forecast + `ineligibleReason` if required feature missing.

**3.4 `src/components/sets/ProductForecastCard.tsx`** — translucent ±RMSE band behind 5y Proj. value; hover tooltip = top-3 feature contributions (XGBoost gain × value).

### Phase 4 — UX at scale

**4.1 Server-side search/filter** — `runFilterPipeline()` moves server-side. `/api/sets/search?theme=X&status=Y&recommendation=Z&q=&page=N`. ForecastDashboard becomes thin client with URL-param state. Facet counts pre-computed nightly into `META#FACETS#v1`.

**4.2 "Show all sets" toggle** — default shows `pricingProviderCount >= 1`. Toggle reveals orphans rendered as `"Tracking — no market data yet"`.

**4.3 Confidence-aware sort** — default = `roi × confidence × log(history_density)`. Pure ROI still available.

### Phase 5 — Continuous operation

**5.1 `.github/workflows/sync-and-retrain.yml`** — monthly cron (1st of month, 03:00 UTC):
- `sync` job runs `bash scripts/sync-all.sh` with all API secrets.
- `train` job (needs sync): `uv sync && uv run python -m src.{dump_training_csv,engineer_features,train_models,backtest,publish}`.
- If model bundle changed → opens auto-PR via `peter-evans/create-pull-request@v6`. Auto-merges if backtest improved AND a human approves.

**5.2 `/api/health/model`** — returns per-horizon `{generatedAt, trainingRows, latestBacktestRMSE, eligiblePct}`. Polled by external monitor.

**5.3 `/admin/model-health`** (basic auth) — time series of per-horizon RMSE, training row count, per-source freshness. Pulls from DDB META rows.

## Error Handling

| Failure | Behavior |
|---|---|
| Any single sync source fails | Pipeline continues; failed source logged. Training uses prior month's data for that source. 3 consecutive failures → alert. |
| BrickLink OAuth fails | Hard fail sync run (primary history source). Immediate alert. |
| Training fails | No publish. Current model stays. Alert with stack trace. |
| Backtest worse than current | No publish. Log + alert with diff. |
| Model JSON malformed at runtime | Catch in `loadForecastModelBundle`, fall back to bundled JSON. |
| Feature vector has nulls for required feature | Return `ineligibleReason: "Missing <feature>"`. Card shows "Insufficient data". |
| Per-API 429 | Exponential backoff w/ jitter, capped 3 retries per row. Continue past 3. |

## Testing

**Python (`lego-ml/tests/`)** — fixture-based unit tests per feature engineer (~50 tests for edge cases: no history, all-zero supply, negative momentum). Backtest self-test: synthetic predictable dataset → model achieves ≥X accuracy. `pytest -q` runs <10s; required in workflow.

**TypeScript** — `lego-forecast-ml.test.ts` cross-language parity test (load fixture XGBoost JSON, score known input, assert prediction matches Python output). `lego-forecast.test.ts` full pipeline (fixture rows → expected Forecast). `npm run verify` continues to gate.

**End-to-end smoke** — `scripts/smoke-test-sync.mjs --limit 50 --dry-run` runs entire sync pipeline for 50 random sets, asserts all 50 produce complete feature vectors.

## Open Decisions Made (autonomous, flag for revision)

1. **Catalog scope** = Rebrickable spine; dashboard default filters out zero-source sets; "Show all" toggle exposes the rest.
2. **BrickLink Price Guide = primary history source.** Real transactions, no scraping, ~10 years of aggregates. PC chart scrape demoted to supplementary.
3. **Python for training, TypeScript for inference (XGBoost JSON between).** Mirrors PokeFuture; reuses its tree-walker.
4. **Monthly sync + retrain cadence.** Daily wasteful for LEGO; weekly possible later.
5. **Auto-PR on model update, manual merge.** Backtest gate + human review prevents regressions.
6. **Server-side `/api/sets/search`** required at 5K+ scale; client-side pipeline removed.
7. **`MIN_HISTORY_POINTS_FOR_FORECAST = 6` stays for now.** BrickLink's 10-year aggregates will trivially clear it; revisit after first sync.
8. **No LLM-generated rationales.** Confidence band + top-3 feature contributions enough.
9. **USD-only.** Brickset regional pricing folded via stored monthly FX from `exchangerate.host`.
10. **No external observability spend.** `/api/health/model` is sufficient for UptimeRobot poll.

## Required Secrets

| Env var | Source |
|---|---|
| `REBRICKABLE_API_KEY` | rebrickable.com/api/ |
| `BRICKSET_API_KEY` + `BRICKSET_USERNAME` + `BRICKSET_PASSWORD` | brickset.com/tools/webservices |
| `BRICKLINK_CONSUMER_KEY` + `_CONSUMER_SECRET` + `_TOKEN_VALUE` + `_TOKEN_SECRET` | bricklink.com/v3/api.page |
| `PRICECHARTING_API_TOKEN` | (already provisioned) |
| `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET` | developer.ebay.com |
| AWS keys + region | (already provisioned) |

User has stated they have these. Workflow secrets must land in GitHub repo settings before the cron can run.

## Decomposition into Implementation Plans

This spec is large. After approval, decompose into **3 sequenced plans**, each its own design → execute → verify cycle. User can pause between any of them.

| Plan | Covers | Surface |
|---|---|---|
| **A** | Phase 1 + DDB keyspace migration + runtime read of full catalog | ~12 scripts, ~8 TS modules, dashboard renders ~5K sets |
| **B** | Phase 2 + 3 (Python training + TS inference + ML-backed forecasts) | new `lego-ml/` dir, ~6 TS modules, model JSON in repo |
| **C** | Phase 4 + 5 (server-side filtering, confidence UX, GH Actions, drift endpoint) | ~3 new API routes, ~4 TS modules, 1 GH workflow |

Plan A unlocks Plan B (needs catalog + history in DDB). Plan B unlocks Plan C (needs models to retrain).
