# LEGO Catalog GWP / Promo Denylist

List of set IDs to exclude as Gift-With-Purchase, employee-only, or
promotional. These sets aren't part of the retail investment catalog and
should never appear in search or forecast surfaces.

Format: JSON array of string IDs that match `LegoSet.id`.

Example:
```json
["40632", "5008786"]
```

The loader (`loadStoredCatalog` in `src/lib/db/lego-search.ts`) also runs
the `isNonRetailSetId` heuristic on each set (matches GWP/polybag/SDCC/
employee/promo patterns in the name). Use this denylist for sets that
need to be removed but don't match those patterns.
