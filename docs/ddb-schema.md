# DynamoDB Schema — `legofuture-cache`

LegoFuture uses a **single DynamoDB table** (`legofuture-cache`) with on-demand
(`PAY_PER_REQUEST`) billing in `us-east-1`. The table is provisioned by
[`scripts/setup-dynamodb.sh`](../scripts/setup-dynamodb.sh) (`npm run setup:ddb`).

## How to read this schema

- **Single-table design.** All entities — catalog, pricing, trends, community
  scores, ML model chunks, BrickLink URL resolutions, sync metadata — live in
  the same table. They are distinguished by their `pk` / `sk` composite key.
- **Primary key only.** `pk` (HASH, String) + `sk` (RANGE, String). No GSIs at
  launch. Every access pattern at launch is a direct `GetItem` or a `Query` on
  a known `pk` prefix.
- **No schema migration is needed** when we add new entity types — DynamoDB
  schemas are per-item, so we just start writing items with new `pk` / `sk`
  patterns.

## Key patterns

| `pk`                  | `sk`                              | Purpose                                                                                       |
| --------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `CATALOG`             | `PRODUCT#<id>`                    | Full `LegoSet` record (canonical catalog entry)                                               |
| `PRICING`             | `PRODUCT#<id>`                    | Live PriceCharting snapshot: `newSealed`, `complete`, `loose`, `updatedAt`                    |
| `META`                | `LAST_SYNC`                       | Last successful sync timestamp                                                                |
| `META`                | `SYNC_METADATA#<yyyymmddhhmm>`    | `{ totalProductsSynced, source: "pricecharting", durationMs, ... }`                           |
| `META`                | `LIMITATIONS#<yyyymmddhhmm>`      | Limitations report (see spec §18)                                                             |
| `TRENDS#<setId>`      | `<yyyymm>`                        | Monthly Google Trends snapshot for a single set                                               |
| `COMMUNITY#<setId>`   | `<yyyymm>`                        | Monthly community score for a single set                                                      |
| `MODEL#lego-ml`       | `CHUNK#<n>`                       | Published ML model chunk (model is split into ordered chunks)                                 |
| `BRICKLINK`           | `SET#<slug>`                      | Resolved BrickLink marketplace URL for a set slug                                             |

### Notes

- Time-bucketed `sk` values (`<yyyymm>`, `<yyyymmddhhmm>`) sort lexicographically
  in ascending chronological order, so range queries like
  `pk = TRENDS#75313 AND sk BETWEEN 202401 AND 202412` work natively.
- The PriceCharting sync script (`scripts/sync-pricecharting-to-dynamo.mjs`) is
  the authoritative writer for `CATALOG` and `PRICING` items today.
- Forward-looking patterns (`TRENDS#`, `COMMUNITY#`, `MODEL#`, `BRICKLINK`) are
  reserved here so all writers agree on the convention as features land.
