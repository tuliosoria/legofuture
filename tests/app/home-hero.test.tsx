import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/data/live-catalog", () => ({
  loadLiveCuratedCatalog: async () => Array.from({ length: 50 }, () => ({
    id: "example", name: "Example set", score: 90, proj5y: 220, currentPrice: 100, signal: "Buy",
  })),
}));
vi.mock("@/components/sets/SetCard", () => ({ SetCard: () => null }));
import HomePage from "@/app/page";

describe("homepage hero", () => {
  it("keeps the catalog count separated even when a crawler extracts adjacent HTML nodes", async () => {
    const html = renderToString(await HomePage());
    expect(html).toContain("5-year return forecasts on 50 investment-grade LEGO sets");
  });
});
