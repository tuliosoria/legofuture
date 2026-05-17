#!/usr/bin/env bash
# sync-all.sh — runs every sync pipeline sequentially, then verifies DDB state.
set -euo pipefail

cd "$(dirname "$0")/.."

npm run sync:pricecharting \
  && npm run sync:trends \
  && npm run sync:community \
  && npm run sync:images \
  && npm run sync:bl-validate \
  && npm run sync:pc-csv \
  && npm run verify:scripts
