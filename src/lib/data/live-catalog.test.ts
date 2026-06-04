import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Forecast, HistoryPoint, LegoSet as DdbLegoSet, ProductPricing } from "@/lib/types/lego";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/lego-search", () => ({
  loadStoredCatalog: vi.fn(),
}));
vi.mock("@/lib/db/lego-history", () => ({
  loadHistory: vi.fn(),
}));
vi.mock("@/lib/domain/lego-forecast", () => ({
  computeMlForecast: vi.fn(),
}));
vi.mock("@/lib/domain/lego-estimate", () => ({
  getPricingFromDdb: vi.fn(),
}));

import { loadStoredCatalog } from "@/lib/db/lego-search";
import { loadHistory } from "@/lib/db/lego-history";
import { computeMlForecast } from "@/lib/domain/lego-forecast";
import { getPricingFromDdb } from "@/lib/domain/lego-estimate";
import { LEGO_SETS } from "@/lib/data/sets";

async function importLiveCatalog() {
  vi.resetModules();
  return import("./live-catalog");
}

function ddbSet(overrides: Partial<DdbLegoSet> = {}): DdbLegoSet {
  const curated = LEGO_SETS[0];
  return {
    id: "5890187",
    setNumber: curated.setNumber,
    name: curated.name,
    theme: "Icons",
    releaseYear: curated.year,
    retired: curated.status === "Retired",
    retirementYear: null,
    pieceCount: curated.pieces,
    minifigCount: 0,
    originalMsrp: curated.msrp,
    imageUrl: "",
    slug: "ddb-slug-is-not-curated-slug",
    ...overrides,
  };
}

function pricing(overrides: Partial<ProductPricing> = {}): ProductPricing {
  return {
    newPrice: null,
    cibPrice: null,
    loosePrice: null,
    salesVolume: null,
    lastFetched: "2026-06-04T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadStoredCatalog).mockResolvedValue([]);
  vi.mocked(loadHistory).mockResolvedValue([]);
  vi.mocked(computeMlForecast).mockResolvedValue(null as unknown as Forecast);
  vi.mocked(getPricingFromDdb).mockResolvedValue(null);
});

describe("toMvpLegoSet", () => {
  const curated = LEGO_SETS[0];

  it("returns curated row unchanged when no live data is available", async () => {
    const { toMvpLegoSet } = await importLiveCatalog();

    const out = toMvpLegoSet({
      curated,
      ddbProduct: null,
      pricing: null,
      history: [],
      mlForecast: null,
    });

    expect(out).toEqual(curated);
  });

  it("overrides currentPrice when pricing has a non-zero newPrice", async () => {
    const { toMvpLegoSet } = await importLiveCatalog();

    const out = toMvpLegoSet({
      curated,
      ddbProduct: ddbSet(),
      pricing: pricing({ newPrice: 420 }),
      history: [],
      mlForecast: null,
    });

    expect(out.currentPrice).toBe(420);
  });

  it("computes momentum from a 12-month-ago history entry", async () => {
    const { toMvpLegoSet } = await importLiveCatalog();
    const history: HistoryPoint[] = [
      { date: "2025-06-04", price: 300 },
      { date: "2026-06-04", price: 420 },
    ];

    const out = toMvpLegoSet({
      curated,
      ddbProduct: ddbSet(),
      pricing: pricing({ newPrice: 420 }),
      history,
      mlForecast: null,
    });

    expect(out.momentum).toBe("+40% 12mo");
  });

  it("falls back to curated momentum when live history has fewer than 2 entries", async () => {
    const { toMvpLegoSet } = await importLiveCatalog();

    const out = toMvpLegoSet({
      curated,
      ddbProduct: ddbSet(),
      pricing: pricing({ newPrice: 420 }),
      history: [{ date: "2026-06-04", price: 420 }],
      mlForecast: null,
    });

    expect(out.momentum).toBe(curated.momentum);
  });

  it("falls back to curated status when DDB row lacks retired/retiringSoon fields", async () => {
    const { toMvpLegoSet } = await importLiveCatalog();

    // Simulate a real-world DDB CATALOG row produced by the current sync
    // pipeline: the row exists, but `retired` and `retiringSoon` were
    // never populated. The adapter must NOT silently flip the curated
    // "Retired" status to "Active" just because DDB knows the set.
    const retiredCurated = LEGO_SETS.find((s) => s.status === "Retired");
    expect(retiredCurated).toBeDefined();
    const ddbWithoutRetirementFlags = ddbSet({
      retired: undefined as unknown as boolean,
      retiringSoon: undefined,
    });

    const out = toMvpLegoSet({
      curated: retiredCurated!,
      ddbProduct: ddbWithoutRetirementFlags,
      pricing: null,
      history: [],
      mlForecast: null,
    });

    expect(out.status).toBe("Retired");
  });

  it("uses ML forecast proj5y/bear/bull when mlForecast is present", async () => {
    const { toMvpLegoSet } = await importLiveCatalog();

    const out = toMvpLegoSet({
      curated,
      ddbProduct: ddbSet(),
      pricing: pricing({ newPrice: 420 }),
      history: [],
      mlForecast: {
        signal: "Hold",
        confidence: "low",
        scenarios: {
          moderate: { projectedValue: 800 },
          pessimist: { projectedValue: 550 },
          optimist: { projectedValue: 1100 },
        },
      } as Forecast,
    });

    expect(out.proj5y).toBe(800);
    expect(out.bear).toBe(550);
    expect(out.bull).toBe(1100);
    expect(out.signal).toBe(curated.signal);
    expect(out.confidence).toBe(curated.confidence);
    expect(out.confLabel).toBe(curated.confLabel);
  });

  it("preserves thesis from curated always", async () => {
    const { toMvpLegoSet } = await importLiveCatalog();

    const out = toMvpLegoSet({
      curated,
      ddbProduct: ddbSet({ name: "Live name" }),
      pricing: pricing({ newPrice: 420 }),
      history: [],
      mlForecast: null,
    });

    expect(out.thesis).toBe(curated.thesis);
  });
});

describe("loadLiveCuratedCatalog", () => {
  it("returns one MvpLegoSet per curated set in the same order", async () => {
    const { loadLiveCuratedCatalog } = await importLiveCatalog();

    const out = await loadLiveCuratedCatalog();

    expect(out).toHaveLength(LEGO_SETS.length);
    expect(out.map((set) => set.id)).toEqual(LEGO_SETS.map((set) => set.id));
  });

  it("joins DDB rows by setNumber field instead of curated slug or product id", async () => {
    const first = LEGO_SETS[0];
    vi.mocked(loadStoredCatalog).mockResolvedValue([
      ddbSet({ id: "5890187", setNumber: first.setNumber, name: "Live Bookshop" }),
    ]);
    vi.mocked(getPricingFromDdb).mockResolvedValue(pricing({ newPrice: 421 }));
    const { loadLiveCuratedCatalog } = await importLiveCatalog();

    const out = await loadLiveCuratedCatalog();

    expect(out[0].currentPrice).toBe(421);
    expect(out[0].id).toBe(first.id);
    expect(loadStoredCatalog).toHaveBeenCalledWith({ includeOrphans: true, orphanCap: 50_000 });
  });

  it("falls back from new-sealed history to complete history", async () => {
    const first = LEGO_SETS[0];
    const live = ddbSet({ setNumber: first.setNumber });
    vi.mocked(loadStoredCatalog).mockResolvedValue([live]);
    vi.mocked(loadHistory)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ date: "2026-06-04", price: 420 }]);
    const { loadLiveCuratedCatalog } = await importLiveCatalog();

    await loadLiveCuratedCatalog();

    expect(loadHistory).toHaveBeenNthCalledWith(1, live, "new-sealed");
    expect(loadHistory).toHaveBeenNthCalledWith(2, live, "complete");
  });

  it("caches the catalog scan within the module TTL", async () => {
    const first = LEGO_SETS[0];
    vi.mocked(loadStoredCatalog).mockResolvedValue([ddbSet({ setNumber: first.setNumber })]);
    const { loadLiveCuratedCatalog } = await importLiveCatalog();

    await loadLiveCuratedCatalog();
    await loadLiveCuratedCatalog();

    expect(loadStoredCatalog).toHaveBeenCalledTimes(1);
  });

  it("returns curated fallback if the catalog scan fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(loadStoredCatalog).mockRejectedValue(new Error("DDB unavailable"));
    const { loadLiveCuratedCatalog } = await importLiveCatalog();

    const out = await loadLiveCuratedCatalog();

    expect(out).toEqual(LEGO_SETS);
    warn.mockRestore();
  });

  it("does not run ML forecast when there is no usable price signal", async () => {
    const first = LEGO_SETS[0];
    vi.mocked(loadStoredCatalog).mockResolvedValue([
      ddbSet({ setNumber: first.setNumber, originalMsrp: 0, forecastEligible: true }),
    ]);
    const { loadLiveCuratedCatalog } = await importLiveCatalog();

    const out = await loadLiveCuratedCatalog();

    expect(computeMlForecast).not.toHaveBeenCalled();
    expect(out[0].proj5y).toBe(first.proj5y);
  });
});

describe("loadLiveCuratedSet", () => {
  it("returns null for an unknown curated slug", async () => {
    const { loadLiveCuratedSet } = await importLiveCatalog();

    await expect(loadLiveCuratedSet("not-a-real-slug")).resolves.toBeNull();
  });

  it("loads one curated slug through the cached setNumber join", async () => {
    const first = LEGO_SETS[0];
    vi.mocked(loadStoredCatalog).mockResolvedValue([ddbSet({ setNumber: first.setNumber })]);
    vi.mocked(getPricingFromDdb).mockResolvedValue(pricing({ newPrice: 455 }));
    const { loadLiveCuratedSet } = await importLiveCatalog();

    const out = await loadLiveCuratedSet(first.id);

    expect(out?.id).toBe(first.id);
    expect(out?.currentPrice).toBe(455);
  });
});

describe("loadLiveHistory", () => {
  it("maps history rows to real-sourced live history points", async () => {
    const first = LEGO_SETS[0];
    const live = ddbSet({ setNumber: first.setNumber });
    vi.mocked(loadStoredCatalog).mockResolvedValue([live]);
    vi.mocked(loadHistory)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ date: "2026-06-04", price: 420 }]);
    const { loadLiveHistory } = await importLiveCatalog();

    const out = await loadLiveHistory(first.id);

    expect(out).toEqual([{ date: "2026-06-04", price: 420, source: "real" }]);
    expect(loadHistory).toHaveBeenNthCalledWith(1, live, "new-sealed");
    expect(loadHistory).toHaveBeenNthCalledWith(2, live, "complete");
  });

  it("returns an empty history for unknown slugs or missing DDB rows", async () => {
    const first = LEGO_SETS[0];
    const { loadLiveHistory } = await importLiveCatalog();

    await expect(loadLiveHistory("not-a-real-slug")).resolves.toEqual([]);
    await expect(loadLiveHistory(first.id)).resolves.toEqual([]);
  });
});
