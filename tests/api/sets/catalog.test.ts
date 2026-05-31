import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// --- mock loadStoredCatalog ------------------------------------------------
const mockLoadStoredCatalog = vi.fn();
vi.mock("@/lib/db/lego-search", () => ({
  loadStoredCatalog: (...args: unknown[]) => mockLoadStoredCatalog(...args),
}));

// --- mock getPricing + computeForecast -------------------------------------
const mockGetPricing = vi.fn();
const mockComputeForecast = vi.fn();
vi.mock("@/lib/domain/lego-estimate", () => ({
  getPricing: (...args: unknown[]) => mockGetPricing(...args),
}));
vi.mock("@/lib/domain/lego-forecast", () => ({
  computeForecast: (...args: unknown[]) => mockComputeForecast(...args),
}));

// --- mock NextRequest / NextResponse ----------------------------------------
import { NextRequest } from "next/server";

import { GET } from "@/app/api/sets/catalog/route";
import type { LegoSet } from "@/lib/types/lego";

function makeSet(id: string, overrides: Partial<LegoSet> = {}): LegoSet {
  return {
    id,
    setNumber: `${id}-1`,
    name: `Set ${id}`,
    theme: "City",
    releaseYear: 2022,
    retired: false,
    retirementYear: null,
    pieceCount: 100,
    minifigCount: 2,
    originalMsrp: 30,
    imageUrl: "",
    slug: `set-${id}`,
    pricingProviderCount: 1,
    investmentUniverse: "InvestableSet" as const,
    ...overrides,
  };
}

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/sets/catalog");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

const defaultForecast = {
  signal: "Hold",
  roiPercent: 10,
  projectedValue: 33,
  dollarGain: 3,
  annualRate: 2,
  currentPrice: 30,
  confidence: "medium",
  scenarios: { pessimist: {}, moderate: {}, optimist: {} },
  updatedAt: "",
};

describe("GET /api/sets/catalog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPricing.mockResolvedValue(null);
    mockComputeForecast.mockReturnValue(defaultForecast);
  });

  it("returns page 1 slice with correct shape", async () => {
    const sets = Array.from({ length: 10 }, (_, i) => makeSet(String(i + 1)));
    mockLoadStoredCatalog.mockResolvedValue(sets);

    const res = await GET(makeRequest({ page: "1", limit: "5" }));
    const body = await res.json();

    expect(body.page).toBe(1);
    expect(body.limit).toBe(5);
    expect(body.total).toBe(10);
    expect(body.hasMore).toBe(true);
    expect(body.items).toHaveLength(5);
    expect(body.items[0]).toHaveProperty("product");
    expect(body.items[0]).toHaveProperty("forecast");
  });

  it("returns hasMore=false on last page", async () => {
    const sets = Array.from({ length: 10 }, (_, i) => makeSet(String(i + 1)));
    mockLoadStoredCatalog.mockResolvedValue(sets);

    const res = await GET(makeRequest({ page: "2", limit: "5" }));
    const body = await res.json();

    expect(body.page).toBe(2);
    expect(body.hasMore).toBe(false);
    expect(body.items).toHaveLength(5);
  });

  it("caps limit at 120 even if client requests more", async () => {
    const sets = Array.from({ length: 200 }, (_, i) => makeSet(String(i + 1)));
    mockLoadStoredCatalog.mockResolvedValue(sets);

    const res = await GET(makeRequest({ page: "1", limit: "999" }));
    const body = await res.json();

    expect(body.limit).toBe(120);
    expect(body.items).toHaveLength(120);
  });

  it("filters by q (text search on name)", async () => {
    const sets = [
      makeSet("1", { name: "Millennium Falcon" }),
      makeSet("2", { name: "Star Destroyer" }),
      makeSet("3", { name: "Falcon Alpha" }),
    ];
    mockLoadStoredCatalog.mockResolvedValue(sets);

    const res = await GET(makeRequest({ q: "falcon" }));
    const body = await res.json();

    expect(body.total).toBe(2);
    expect(body.items.map((i: { product: LegoSet }) => i.product.id)).toContain("1");
    expect(body.items.map((i: { product: LegoSet }) => i.product.id)).toContain("3");
    expect(body.items.map((i: { product: LegoSet }) => i.product.id)).not.toContain("2");
  });

  it("filters by theme", async () => {
    const sets = [
      makeSet("1", { theme: "City" }),
      makeSet("2", { theme: "Technic" }),
      makeSet("3", { theme: "City" }),
    ];
    mockLoadStoredCatalog.mockResolvedValue(sets);

    const res = await GET(makeRequest({ theme: "City" }));
    const body = await res.json();

    expect(body.total).toBe(2);
  });

  it("filters by status=retired", async () => {
    const sets = [
      makeSet("1", { retired: true }),
      makeSet("2", { retired: false }),
    ];
    mockLoadStoredCatalog.mockResolvedValue(sets);

    const res = await GET(makeRequest({ status: "retired" }));
    const body = await res.json();

    expect(body.total).toBe(1);
    expect(body.items[0].product.id).toBe("1");
  });

  it("passes includeOrphans to loadStoredCatalog", async () => {
    mockLoadStoredCatalog.mockResolvedValue([]);

    await GET(makeRequest({ includeOrphans: "1" }));

    expect(mockLoadStoredCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ includeOrphans: true })
    );
  });

  it("returns 400 for invalid page number", async () => {
    const res = await GET(makeRequest({ page: "0" }));
    expect(res.status).toBe(400);
  });

  it("mode=investment filters to InvestableSet universe", async () => {
    const sets = [
      makeSet("1", { investmentUniverse: "InvestableSet" }),
      makeSet("2", { investmentUniverse: "CollectorCatalog" }),
      makeSet("3", { investmentUniverse: "DataIssue" }),
      makeSet("4", { investmentUniverse: "RetiredTracker" }),
    ];
    mockLoadStoredCatalog.mockResolvedValue(sets);

    const res = await GET(makeRequest({ mode: "investment" }));
    const body = await res.json();

    expect(body.total).toBe(1);
    expect(body.items[0].product.id).toBe("1");
  });

  it("mode=tracker filters to RetiredTracker universe", async () => {
    const sets = [
      makeSet("1", { investmentUniverse: "InvestableSet" }),
      makeSet("2", { investmentUniverse: "RetiredTracker" }),
    ];
    mockLoadStoredCatalog.mockResolvedValue(sets);

    const res = await GET(makeRequest({ mode: "tracker" }));
    const body = await res.json();

    expect(body.total).toBe(1);
    expect(body.items[0].product.id).toBe("2");
  });

  it("mode=collector filters to CollectorCatalog universe", async () => {
    const sets = [
      makeSet("1", { investmentUniverse: "InvestableSet" }),
      makeSet("2", { investmentUniverse: "CollectorCatalog" }),
    ];
    mockLoadStoredCatalog.mockResolvedValue(sets);

    const res = await GET(makeRequest({ mode: "collector" }));
    const body = await res.json();

    expect(body.total).toBe(1);
    expect(body.items[0].product.id).toBe("2");
  });
});
