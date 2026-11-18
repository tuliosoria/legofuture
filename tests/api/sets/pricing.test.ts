import {describe, it, expect, vi} from "vitest";
import {NextRequest} from "next/server";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/lego-search", () => ({getProductBySlug: vi.fn().mockResolvedValue({id: "123"}), getProductById: vi.fn()}));
vi.mock("@/lib/domain/lego-estimate", () => ({getPricing: vi.fn()}));
vi.mock("@/lib/db/rate-limit", () => ({enforceIpRateLimit: vi.fn().mockResolvedValue(null)}));
import {getPricing} from "@/lib/domain/lego-estimate";
import {GET} from "@/app/api/sets/pricing/route";

describe("pricing endpoint provenance", () => {
  it("does not publish a fabricated freshness header for unknown observations", async () => {
    vi.mocked(getPricing).mockResolvedValue({newPrice: 100, cibPrice: null, loosePrice: null, salesVolume: null, lastFetched: null});
    const res = await GET(new NextRequest("https://example.com/api/sets/pricing?slug=test"));
    expect(res.headers.get("X-Data-Freshness")).toBeNull();
    expect((await res.json()).updatedAt).toBeNull();
  });
  it("returns individual observation dates separately from latest eBay check", async () => {
    const observations = {newSealed: {source: "ebay-median", observedAt: "2026-11-10T00:00:00Z"}, complete: null, loose: null};
    const ebayCheck = {checkedAt: "2026-11-18T00:00:00Z", status: "thin"};
    vi.mocked(getPricing).mockResolvedValue({newPrice: 100, cibPrice: null, loosePrice: null, salesVolume: null, lastFetched: "2026-11-10T00:00:00Z", observations, ebayCheck});
    const res = await GET(new NextRequest("https://example.com/api/sets/pricing?slug=test"));
    expect(res.headers.get("X-Data-Freshness")).toBe("2026-11-10T00:00:00Z");
    expect(await res.json()).toMatchObject({observations, ebayCheck});
  });
});
