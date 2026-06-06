# LEGO Future

LEGO set investment forecasting — Next.js 16 + Tailwind v4 on AWS Amplify
(WEB_COMPUTE). Live at [bricksfuture.com](https://bricksfuture.com).

## Spec

Architectural parity with PokeFuture — see Phase recipe in spec §16.
Implementation follows the same forecast / data-sync / legal-page pattern,
adapted for LEGO sets and PriceCharting's `lego` console.

## Development

```sh
npm ci
npm run dev       # local dev server on :3000
npm run verify    # lint + test + build
```

See [AGENTS.md](./AGENTS.md) for AI agent guidance, including the
superpowers and Vercel React best-practices skills this repo uses.

## Data sync

BricksFuture aggregates pricing from PriceCharting (PC), BrickLink (BL),
Brickset (BS), and eBay sold listings. Each source has its own script in
`scripts/`. All scripts are **idempotent and resumable** via a
`META#{SOURCE}_PROGRESS` checkpoint in DynamoDB.

```sh
# One-off: run every source whose credentials are present in .env.local
bash scripts/sync-all.sh 2>&1 | tee /tmp/sync-all.log

# Single source (resumes automatically; set FOO_RESUME=false to restart):
node --env-file=.env.local scripts/sync-bricklink-pricing.mjs
node --env-file=.env.local scripts/sync-brickset-enrichment.mjs
node --env-file=.env.local scripts/sync-ebay-sold-listings.mjs
node --env-file=.env.local scripts/sync-pricecharting-to-dynamo.mjs
```

Required env vars are documented in `.env.example` (each source links to
its registration page).

### Nightly cron (GitHub Action recommended)

`.github/workflows/sync-nightly.yml`:

```yaml
name: nightly-sync
on:
  schedule: [{ cron: "17 5 * * *" }]   # 05:17 UTC daily
  workflow_dispatch: {}
jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 350
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: bash scripts/sync-all.sh
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
          DYNAMODB_TABLE: legofuture-cache
          PRICECHARTING_API_TOKEN: ${{ secrets.PRICECHARTING_API_TOKEN }}
          REBRICKABLE_API_KEY: ${{ secrets.REBRICKABLE_API_KEY }}
          BRICKLINK_CONSUMER_KEY: ${{ secrets.BRICKLINK_CONSUMER_KEY }}
          BRICKLINK_CONSUMER_SECRET: ${{ secrets.BRICKLINK_CONSUMER_SECRET }}
          BRICKLINK_TOKEN_VALUE: ${{ secrets.BRICKLINK_TOKEN_VALUE }}
          BRICKLINK_TOKEN_SECRET: ${{ secrets.BRICKLINK_TOKEN_SECRET }}
          BRICKSET_API_KEY: ${{ secrets.BRICKSET_API_KEY }}
          BRICKSET_USERNAME: ${{ secrets.BRICKSET_USERNAME }}
          BRICKSET_PASSWORD: ${{ secrets.BRICKSET_PASSWORD }}
          EBAY_CLIENT_ID: ${{ secrets.EBAY_CLIENT_ID }}
          EBAY_CLIENT_SECRET: ${{ secrets.EBAY_CLIENT_SECRET }}
```

Each source skips gracefully if its credentials are absent, so the job
runs even with partial config. Resume checkpoints mean an interrupted
run picks up where it left off on the next invocation.
