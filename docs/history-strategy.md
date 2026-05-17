# Price History Strategy

## Problem

The ML retrainer needs a real time-series of LEGO set prices (loose / CIB / new) to learn appreciation trends. The two obvious sources both have caveats:

1. **PriceCharting bulk-history CSV endpoint** — returns `404` for our API token. Our subscription tier does not include the LEGO history bulk download. We confirmed this against `https://www.pricecharting.com/api/product-prices?...&platform=lego` repeatedly.
2. **Per-set scraping** — possible but slow; rate-limited to ~1 req / 500 ms to stay polite.

Without history we have a single price point per set → ML cannot train anything time-aware.

## Two-pronged solution

### 1. One-time backfill (scrape)

`scripts/scrape-pricecharting-history.mjs` (driven by `npm run sync:pc-history`, owned by the `lf-history-scrape` agent) walks the PriceCharting product page for each catalog row and scrapes the embedded history chart JSON. When this succeeds it lights up ML **immediately** with N months of synthetic-but-real history.

This pipeline is best-effort: scrapers break when the upstream HTML changes. We keep it in the pipeline but never assume it succeeded.

### 2. Organic snapshot bootstrap (this PR)

Every price-sync run now also writes a `HISTORY#PRODUCT#<id>` row with `sk = <YYYY-MM>` capturing the current loose / CIB / new prices. This is implemented in:

- `scripts/sync-pricecharting-to-dynamo.mjs` — paired with each `PRICING#PRODUCT#<id>` write.
- `scripts/sync-images.mjs` — paired with each product-detail fetch (reuses the price data already returned by the search endpoint).
- `scripts/backfill-current-month-history.mjs` — one-off bootstrap that walks every existing `PRICING#PRODUCT#*` row and emits a HISTORY row for the current month. Run via `npm run sync:history-snapshot`.

Writes use `PutCommand` with no condition so a monthly re-run overwrites the same `<YYYY-MM>` row idempotently. The history write is wrapped in try/catch so a failure never crashes the main sync. Per-script success counts are recorded in `META#SYNC_METADATA` under `history_snapshots_written`.

Schema of each row:

```json
{
  "pk": "HISTORY#PRODUCT#<pc-id>",
  "sk": "2025-11",
  "id": "<pc-id>",
  "loose": 1234.56,
  "cib":   1599.99,
  "new":   1899.99,
  "source": "pricecharting-snapshot",
  "capturedAt": "2025-11-12T03:14:15.000Z"
}
```

## When does ML light up?

- **Immediately**, if `sync:pc-history` succeeds — the scrape backfills N months in one go.
- **6 months from the first snapshot**, if scraping never works — by then every set has 6 monthly rows, which is the minimum we need for a usable seasonal/linear trend signal.

Either way, doing nothing is no longer an option: every nightly sync now accrues real data automatically.
