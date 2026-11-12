/**
 * When does an eBay median replace a LEGO set's current price?
 *
 * Owner decision (PokeFuture 2026-11-10, applied to BricksFuture 2026-11-12):
 * the median is used only when the sample is thick (>= 8 listings) AND within
 * a factor of two of the last known price; otherwise the set keeps that price.
 * Nothing drops out of the catalog, and one bad search cannot move a price by
 * more than 2x in a single refresh.
 */
export const MIN_EBAY_LISTINGS = 8;
export const MIN_RATIO = 0.5;
export const MAX_RATIO = 2;

/**
 * @param {{ lastKnown: number, aggregate: { activeCount: number, p50: number | null } | null }} input
 * @returns {{ status: "accepted" | "thin" | "out-of-band" | "no-data", price: number }}
 */
export function decideEbayPrice({ lastKnown, aggregate }) {
  const p50 = aggregate?.p50;
  if (!aggregate || typeof p50 !== "number" || !Number.isFinite(p50) || p50 <= 0) {
    return { status: "no-data", price: lastKnown };
  }
  if (aggregate.activeCount < MIN_EBAY_LISTINGS) return { status: "thin", price: lastKnown };
  const ratio = p50 / lastKnown;
  if (ratio < MIN_RATIO || ratio > MAX_RATIO) return { status: "out-of-band", price: lastKnown };
  return { status: "accepted", price: Math.round(p50 * 100) / 100 };
}

// Titles that are not the complete, new set: parts of it, add-ons for it,
// several copies, or knock-offs. `unless` lets a sealed set that merely
// mentions its contents through ("Sealed, 25 Minifigures", "No Box Damage").
const NOT_A_SET = [
  { pattern: /\bminifig(ure)?s?\b/i, unless: /\b\d{1,3}\s+minifig/i },
  // minifigure catalogue codes (sh833, sw0001, hp150, col123, njo456, ...)
  { pattern: /\b(sh|sw|hp|col|njo|cty|idea|tlm|lor|poc|dim)\d{3,4}[a-z]?\b/i, unless: /\bsealed\b/i },
  { pattern: /\binstructions?\b(?!\s+(included|inside))/i },
  { pattern: /\bmanuals?\b(?!\s+(included|inside))/i },
  { pattern: /\bbox only\b/i },
  { pattern: /\bempty box\b/i },
  { pattern: /\bno box\b(?!\s+(damage|dents?|wear|creases?))/i },
  { pattern: /\bbags? \d+(\s*(-|to)\s*\d+)?\s+only\b/i },
  { pattern: /\bbag only\b/i },
  { pattern: /\blot\b/i },
  { pattern: /\bcustom\b/i },
  { pattern: /\bmoc\b/i },
  { pattern: /\bcompatible\b/i },
  { pattern: /\bgeneric\b/i },
  { pattern: /\breplica\b/i },
  { pattern: /\bknock-?off\b/i },
  { pattern: /\bled\b/i },
  { pattern: /\blight(ing)? kit\b/i },
  { pattern: /\bdisplay (case|stand)\b/i },
  { pattern: /\bacrylic\b/i },
  { pattern: /\bstickers?\b/i },
  { pattern: /\breplacement\b/i },
  { pattern: /\bincomplete\b/i },
  { pattern: /\bparts? only\b/i },
];

/** True when an eBay title is the complete set with this exact set number. */
export function isSetListing(title, setNumber) {
  if (typeof title !== "string" || !setNumber) return false;
  const exact = new RegExp(`(^|[^0-9])${String(setNumber).replace(/[^0-9a-z]/gi, "")}([^0-9]|$)`, "i");
  if (!exact.test(title)) return false;
  return !NOT_A_SET.some(({ pattern, unless }) => pattern.test(title) && !(unless && unless.test(title)));
}

export const MIN_PRICE_FACTOR = 0.25;
export const MAX_PRICE_FACTOR = 4;

/**
 * Count and median of the usable prices, or null when there are none.
 * With a last known price, listings below 0.25x or above 4x of it (parts,
 * accessories that slip past the title filter, placeholder prices) are
 * dropped before counting, so they cannot thicken a thin sample.
 */
export function summarizePrices(prices, lastKnown) {
  const inRange = (p) =>
    !(lastKnown > 0) || (p >= lastKnown * MIN_PRICE_FACTOR && p <= lastKnown * MAX_PRICE_FACTOR);
  const usable = prices
    .filter((p) => typeof p === "number" && Number.isFinite(p) && p > 0 && inRange(p))
    .sort((a, b) => a - b);
  if (usable.length === 0) return null;
  const mid = Math.floor(usable.length / 2);
  const p50 = usable.length % 2 ? usable[mid] : (usable[mid - 1] + usable[mid]) / 2;
  return { activeCount: usable.length, p50 };
}

/**
 * Daily work list: every curated set, then a rotating slice of the rest of
 * the priced catalog (never-checked first, then oldest check first).
 *
 * lastKnown = previous eBay price ?? PriceCharting new price (May 2026
 * snapshot, cents) ?? curated price.
 */
export function buildWorkList({ curated, catalog, pcNewPriceCents, ebayRows, rotationLimit }) {
  const pcBySet = new Map();
  for (const row of catalog) {
    if (!row.setNumber) continue;
    const cents = pcNewPriceCents.get(row.id);
    if (typeof cents === "number" && cents > 0 && !pcBySet.has(String(row.setNumber))) {
      pcBySet.set(String(row.setNumber), cents / 100);
    }
  }
  const lastKnownFor = (setNumber, fallback) => {
    const ebay = ebayRows.get(setNumber)?.price;
    if (typeof ebay === "number" && ebay > 0) return ebay;
    return pcBySet.get(setNumber) ?? fallback;
  };

  const items = [];
  const seen = new Set();
  for (const set of curated) {
    const lastKnown = lastKnownFor(set.setNumber, set.currentPrice);
    if (!(lastKnown > 0) || seen.has(set.setNumber)) continue;
    seen.add(set.setNumber);
    items.push({ setNumber: set.setNumber, lastKnown, curated: true });
  }

  const rest = [];
  for (const setNumber of pcBySet.keys()) {
    if (seen.has(setNumber)) continue;
    seen.add(setNumber);
    rest.push({ setNumber, lastKnown: lastKnownFor(setNumber, null), curated: false });
  }
  const checkedAt = (setNumber) => ebayRows.get(setNumber)?.checkedAt ?? "";
  rest.sort((a, b) => checkedAt(a.setNumber).localeCompare(checkedAt(b.setNumber)) || a.setNumber.localeCompare(b.setNumber));
  return items.concat(rest.filter((item) => item.lastKnown > 0).slice(0, Math.max(0, rotationLimit)));
}

/** A run that accepted nothing is a broken collection, not a quiet market. */
export function collectionLooksBroken(results) {
  return !results.some((r) => r.status === "accepted");
}

/** Markdown run report (stdout, workflow step summary). */
export function formatSummary(results, { dryRun }) {
  const count = (status) => results.filter((r) => r.status === status).length;
  const movers = results
    .filter((r) => r.status === "accepted" && r.lastKnown > 0)
    .map((r) => ({ ...r, change: r.price / r.lastKnown - 1 }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 15);
  const lines = [
    `## eBay price refresh${dryRun ? " (dry run)" : ""}`,
    "",
    `Checked ${results.length} sets (${results.filter((r) => r.curated).length} curated).`,
    "",
    `| status | sets |`,
    `|---|---|`,
    `| accepted (eBay median) | ${count("accepted")} |`,
    `| thin (< 8 listings, kept last price) | ${count("thin")} |`,
    `| out-of-band (kept last price) | ${count("out-of-band")} |`,
    `| no data (kept last price) | ${count("no-data")} |`,
    "",
    "### Largest accepted moves",
    "",
    "| set | before | now | change | listings |",
    "|---|---|---|---|---|",
    ...movers.map(
      (r) =>
        `| ${r.setNumber}${r.curated ? " ★" : ""} | $${r.lastKnown.toFixed(2)} | $${r.price.toFixed(2)} | ${(r.change * 100).toFixed(1)}% | ${r.activeCount} |`
    ),
  ];
  const stuck = results.filter((r) => r.curated && r.status !== "accepted");
  if (stuck.length) {
    lines.push(
      "",
      "### Curated sets that kept their last price",
      "",
      "| set | status | kept | eBay median | listings |",
      "|---|---|---|---|---|",
      ...stuck.map(
        (r) =>
          `| ${r.setNumber} | ${r.status} | $${r.lastKnown.toFixed(2)} | ${typeof r.p50 === "number" ? `$${r.p50.toFixed(2)}` : "—"} | ${r.activeCount} |`
      )
    );
  }
  return lines.join("\n") + "\n";
}
