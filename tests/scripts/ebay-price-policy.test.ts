import { describe, expect, it } from "vitest";
import {
  MAX_RATIO,
  MIN_EBAY_LISTINGS,
  MIN_RATIO,
  buildWorkList,
  collectionLooksBroken,
  formatSummary,
  decideEbayPrice,
  isSetListing,
  summarizePrices,
} from "../../scripts/lib/ebay-price-policy.mjs";

const agg = (activeCount: number, p50: number | null) => ({ activeCount, p50 });

describe("decideEbayPrice", () => {
  it("pins the approved thresholds", () => {
    expect([MIN_EBAY_LISTINGS, MIN_RATIO, MAX_RATIO]).toEqual([8, 0.5, 2]);
  });

  it("accepts a thick, in-band median rounded to cents, including the band edges", () => {
    expect(decideEbayPrice({ lastKnown: 100, aggregate: agg(8, 150.004) })).toEqual({ status: "accepted", price: 150 });
    expect(decideEbayPrice({ lastKnown: 100, aggregate: agg(20, 200) }).status).toBe("accepted");
    expect(decideEbayPrice({ lastKnown: 100, aggregate: agg(20, 50) }).status).toBe("accepted");
  });

  it("keeps the last known price when thin, out of band or without data", () => {
    expect(decideEbayPrice({ lastKnown: 100, aggregate: agg(7, 150) })).toEqual({ status: "thin", price: 100 });
    expect(decideEbayPrice({ lastKnown: 100, aggregate: agg(50, 201) })).toEqual({ status: "out-of-band", price: 100 });
    expect(decideEbayPrice({ lastKnown: 100, aggregate: agg(50, 49) })).toEqual({ status: "out-of-band", price: 100 });
    expect(decideEbayPrice({ lastKnown: 100, aggregate: null })).toEqual({ status: "no-data", price: 100 });
    expect(decideEbayPrice({ lastKnown: 100, aggregate: agg(30, 0) }).status).toBe("no-data");
  });
});

describe("isSetListing", () => {
  it("requires the exact set number as a token", () => {
    expect(isSetListing("LEGO Star Wars 75192 Millennium Falcon UCS New Sealed", "75192")).toBe(true);
    expect(isSetListing("LEGO 75192-1 Millennium Falcon", "75192")).toBe(true);
    expect(isSetListing("LEGO 751920 something", "75192")).toBe(false);
    expect(isSetListing("LEGO Millennium Falcon UCS", "75192")).toBe(false);
  });

  it("keeps sealed sets whose titles mention their minifigures, instructions or box condition", () => {
    for (const title of [
      "LEGO 76178 Daily Bugle New Sealed 25 Minifigures",
      "LEGO 76269 Avengers Tower NEW SEALED 31 minifigs",
      "LEGO 75222 Cloud City Sealed with SW0001 Exclusive",
      "LEGO 75192 NEW Sealed, No Box Damage",
      "LEGO 75192 New, Instructions included",
      "LEGO 75192 New Sealed Never Opened",
      "LEGO 75192 brand new never used",
      "LEGO 75192 New not opened",
      "LEGO 75192 Sealed (Bag 1-60 inside)",
    ]) {
      const set = title.match(/\d{5}/)![0];
      expect(isSetListing(title, set), title).toBe(true);
    }
  });

  it("rejects minifigures, manuals, boxes, lots, custom and add-on products", () => {
    for (const title of [
      "LEGO 75192 Han Solo minifigure only",
      "LEGO 75192 Minifig Chewbacca",
      "LEGO 75192 Instructions only",
      "LEGO 75192 instruction manual",
      "LEGO 75192 EMPTY BOX",
      "LEGO 75192 box only no bricks",
      "Lot of 3 LEGO 75192",
      "LEGO 75192 job lot",
      "Custom MOC stand for LEGO 75192",
      "LED light kit for LEGO 75192",
      "Acrylic display case for LEGO 75192",
      "LEGO 75192 sticker sheet replacement",
      "LEGO 75192 incomplete",
      "Compatible building blocks 75192",
      "LEGO 75192 bag 12 only",
      "GENERIC Millennium Falcon 75192 7541 pcs",
      "Replica of 75192 building set",
      "LEGO NEW DEAD DOCTOR STRANGE sh833 Marvel MCU 75192 Sanctum Sanctorum",
    ]) {
      expect(isSetListing(title, "75192"), title).toBe(false);
    }
  });
});

describe("summarizePrices", () => {
  it("returns the listing count and the median", () => {
    expect(summarizePrices([10, 30, 20])).toEqual({ activeCount: 3, p50: 20 });
    expect(summarizePrices([10, 20, 30, 40])).toEqual({ activeCount: 4, p50: 25 });
    expect(summarizePrices([0, Number.NaN, -1])).toBeNull();
  });

  it("drops prices below 0.25x or above 4x of the last known price before counting", () => {
    // two $25-60 minifig packs and a $9,999 placeholder around a ~$850 set
    expect(summarizePrices([24.99, 59.99, 800, 899.99, 1349.95, 9999], 850)).toEqual({ activeCount: 3, p50: 899.99 });
    expect(summarizePrices([10, 20], 1000)).toBeNull();
  });
});

describe("buildWorkList", () => {
  const curated = [
    { setNumber: "10270", currentPrice: 380 },
    { setNumber: "10264", currentPrice: 490 },
  ];
  const catalog = [
    { id: "pc1", setNumber: "10270" },
    { id: "pc2", setNumber: "7452" },
    { id: "pc3", setNumber: "6000" },
    { id: "pc4", setNumber: "6001" },
    { id: "pc5", setNumber: null },
  ];
  const pcNewPriceCents = new Map([["pc1", 41000], ["pc2", 870], ["pc3", 1500], ["pc4", 2500], ["pc5", 999]]);

  it("puts curated sets first with lastKnown from eBay, then PriceCharting, then the curated price", () => {
    const ebayRows = new Map([["10264", { price: 512.4, checkedAt: "2026-11-11T07:00:00Z" }]]);
    const items = buildWorkList({ curated, catalog, pcNewPriceCents, ebayRows, rotationLimit: 0 });
    expect(items).toEqual([
      { setNumber: "10270", lastKnown: 410, curated: true },
      { setNumber: "10264", lastKnown: 512.4, curated: true },
    ]);
  });

  it("rotates the rest of the priced catalog, never-checked first, capped by rotationLimit", () => {
    const ebayRows = new Map([
      ["6000", { price: 16, checkedAt: "2026-11-10T07:00:00Z" }],
      ["7452", { price: 9, checkedAt: "2026-11-11T07:00:00Z" }],
    ]);
    const items = buildWorkList({ curated, catalog, pcNewPriceCents, ebayRows, rotationLimit: 2 });
    expect(items.slice(2)).toEqual([
      { setNumber: "6001", lastKnown: 25, curated: false },
      { setNumber: "6000", lastKnown: 16, curated: false },
    ]);
  });

  it("skips catalog rows without a set number or a positive last known price", () => {
    const items = buildWorkList({
      curated: [],
      catalog: [{ id: "x", setNumber: "1" }, { id: "pc5", setNumber: null }],
      pcNewPriceCents: new Map([["x", 0]]),
      ebayRows: new Map(),
      rotationLimit: 10,
    });
    expect(items).toEqual([]);
  });
});

describe("collectionLooksBroken", () => {
  it("is true when nothing was accepted", () => {
    expect(collectionLooksBroken([{ status: "no-data" }, { status: "thin" }])).toBe(true);
    expect(collectionLooksBroken([])).toBe(true);
    expect(collectionLooksBroken([{ status: "thin" }, { status: "accepted" }])).toBe(false);
  });
});

describe("formatSummary", () => {
  it("lists curated sets that kept their old price, so stuck anchors are visible", () => {
    const md = formatSummary(
      [
        { setNumber: "10270", curated: true, status: "accepted", lastKnown: 380, price: 400, activeCount: 30, p50: 400 },
        { setNumber: "10220", curated: true, status: "out-of-band", lastKnown: 173, price: 173, activeCount: 40, p50: 520 },
        { setNumber: "21044", curated: true, status: "thin", lastKnown: 49, price: 49, activeCount: 3, p50: 110 },
        { setNumber: "6000", curated: false, status: "out-of-band", lastKnown: 10, price: 10, activeCount: 9, p50: 50 },
      ],
      { dryRun: false }
    );
    expect(md).toContain("### Curated sets that kept their last price");
    expect(md).toContain("| 10220 | out-of-band | $173.00 | $520.00 | 40 |");
    expect(md).toContain("| 21044 | thin | $49.00 | $110.00 | 3 |");
    expect(md).not.toContain("| 6000 |");
    expect(md).toContain("| 10270 ★ | $380.00 | $400.00 | 5.3% | 30 |");
  });
});

describe("single-set identity regressions", () => {
  it.each([
    "LEGO 75192 75193 bundle new sealed",
    "LEGO 75192 x2 sealed",
    "LEGO 75192 2x new sealed",
    "LEGO 75192 pack of 2",
    "LEGO 75192 unopened box only",
    "LEGO 75192 new sealed bags only",
    "LEGO 75192 used complete",
    "LEGO 75192 opened box never used",
    "LEGO 75192 compatible with LEGO",
    "LEGO A75192B",
  ])("rejects %s", (title) => expect(isSetListing(title, "75192")).toBe(false));
  it.each(["", "abc", "75192 OR 75193"])("rejects invalid set identifier %s", (set) => {
    expect(isSetListing("LEGO 75192 new sealed", set)).toBe(false);
  });
});

describe("invalid reference data", () => {
  it("does not accept invalid sample counts or anchors", () => {
    for (const count of [Number.NaN, Infinity, 8.5]) {
      expect(decideEbayPrice({lastKnown: 100, aggregate: agg(count, 100)}).status).not.toBe("accepted");
    }
    for (const lastKnown of [Number.NaN, Infinity, 0, -100]) {
      expect(decideEbayPrice({lastKnown, aggregate: agg(8, 100)}).status).not.toBe("accepted");
    }
  });
});
