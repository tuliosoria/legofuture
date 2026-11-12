import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/rate-limit", () => ({ enforceIpRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/server/ebay-listings", () => ({
  fetchEbayListings: vi.fn(async () => {
    throw new Error('eBay Browse search failed: HTTP 429 {"errors":[{"errorId":2001,"message":"Too many requests"}]}');
  }),
}));

import { POST } from "@/app/api/ebay/listings/route";

describe("POST /api/ebay/listings", () => {
  it("does not forward eBay's raw error body to the browser", async () => {
    const req = new NextRequest("http://localhost:3000/api/ebay/listings", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ keywords: "LEGO 75192", productKey: "75192", surface: "lego-detail" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "eBay listings are unavailable right now." });
  });
});
