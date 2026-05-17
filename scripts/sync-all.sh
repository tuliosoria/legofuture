#!/usr/bin/env bash
# scripts/sync-all.sh — orchestrates every data source.
# Each step no-ops gracefully if its required env vars are missing.
set -e
cd "$(dirname "$0")/.."

# Load .env.local into the current shell so the `run_if` env-var check sees them.
if [[ -f .env.local ]]; then
  set -a
  . .env.local
  set +a
fi

run_if() {
  local name="$1"; shift
  local script="$1"; shift
  for var in "$@"; do
    if [[ -z "${!var:-}" ]]; then
      echo "[sync-all] SKIP $name (missing $var)"
      return 0
    fi
  done
  echo "[sync-all] RUN $name"
  node --env-file=.env.local "$script" || echo "[sync-all] WARN $name failed (continuing)"
}

# Catalog spine FIRST.
run_if rebrickable scripts/sync-rebrickable-catalog.mjs REBRICKABLE_API_KEY

# Enrichment + pricing in parallel.
run_if pricecharting scripts/sync-pricecharting-to-dynamo.mjs PRICECHARTING_API_TOKEN &
run_if brickset scripts/sync-brickset-enrichment.mjs BRICKSET_API_KEY BRICKSET_USERNAME BRICKSET_PASSWORD &
run_if bricklink scripts/sync-bricklink-pricing.mjs BRICKLINK_CONSUMER_KEY BRICKLINK_CONSUMER_SECRET BRICKLINK_TOKEN_VALUE BRICKLINK_TOKEN_SECRET &
run_if ebay scripts/sync-ebay-sold-listings.mjs EBAY_CLIENT_ID EBAY_CLIENT_SECRET &
run_if trends scripts/sync-google-trends.mjs &
run_if community scripts/sync-community.mjs &
wait

# Supplementary PC chart scrape.
run_if pc-history scripts/scrape-pricecharting-history.mjs PRICECHARTING_API_TOKEN

echo "[sync-all] complete"
