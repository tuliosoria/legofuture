# Provider artifact inventory — local source inspection, 14 October 2026

No remote data, private files, credentials, or workflow contents were read. This manifest records repository paths and known key shapes, not a remote inventory.

| Path / key | Origin | Publication rights | Public dependency / action |
| --- | --- | --- | --- |
| src/lib/data/sets.ts | Curated mixed references and estimates | Price provenance unverified | Identity preserved; price/forecast publication suspended |
| CATALOG#PRODUCT#*, src/lib/db/lego-search.ts | Rebrickable / PC / curated | Per field unverified | Preserve identity; no sold-liquidity inference |
| PRICING#PRODUCT#*, lego-estimate.ts caches | PC, BrickLink, Brickset, eBay Browse | Legacy provenance/license unverified | Resolver quarantines legacy rows and cache |
| HISTORY#PRODUCT#*, lego-history.ts | PC, snapshots, synthetic, mislabeled Browse | Unverified | Public history suspended, rows preserved |
| ebay-sold and ebay-sold#month | Browse active offers, NOT sales | Unverified | Never consumed as sold; new writes use ebay-asking-v1 |
| soldComps90d | Browse active count, NOT sales | Unverified | Do not use for liquidity; new writes activeListingCount |
| src/lib/db/bundled/lego-forecast-*.json | Trained models | Training/license unverified | Preserved, forecast publication suspended |
| lego-ml/, infra/lego-ml-retrainer/ | Training pipelines | Unverified | No retrain/upload/deploy; operator must audit schedules |
| public/, catalog imageUrl, scripts/sync-images.mjs | Mixed image origins | Independent rights unverified | No deletion; no new PC requests; image audit required before rollout |
| PC sync/CSV/history scripts, synthetic/backfill scripts | PC or derived data | Unverified | Entrypoints disabled reversibly |
| .github/workflows/ (contents deliberately unread) | Operational schedules | Sanitized review required | External schedule gate remains open |

Restoring an artifact's publication requires verified rights, exact identity/condition/currency, observation date, sample and sold period where relevant. Retention or deletion is a separate authorized decision; nothing here deletes historical data.
