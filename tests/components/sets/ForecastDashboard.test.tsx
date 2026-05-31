/**
 * @vitest-environment jsdom
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

// ---- module mocks --------------------------------------------------------
vi.mock("server-only", () => ({}));

// Stub out heavy sub-components so the test stays focused on pagination logic
vi.mock("@/components/sets/ProductForecastCard", () => ({
  ProductForecastCard: ({ product }: { product: { name: string } }) => (
    React.createElement("div", { "data-testid": "forecast-card" }, product.name)
  ),
}));
vi.mock("@/components/sets/TopBuyOpportunities", () => ({
  TopBuyOpportunities: () => React.createElement("div", { "data-testid": "top-buys" }),
}));
vi.mock("@/components/sets/filter-sidebar", () => ({
  FilterSidebar: ({ onChange }: { onChange: (s: unknown) => void }) =>
    React.createElement("div", { "data-testid": "filter-sidebar", onClick: () => onChange({ query: "test-filter", themes: [], status: "all", recommendation: "all", scenario: "moderate", sort: "upside" }) }),
}));
vi.mock("@/components/sets/search-box", () => ({
  SearchBox: ({ onChange }: { onChange: (q: string) => void }) =>
    React.createElement("input", { "data-testid": "search-box", onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) }),
}));
vi.mock("@/components/sets/SkeletonForecastCard", () => ({
  SkeletonForecastCard: () => React.createElement("div", { "data-testid": "skeleton" }),
}));
vi.mock("lucide-react", () => ({
  SlidersHorizontal: () => React.createElement("span"),
}));

// ---- fetch mock ----------------------------------------------------------
const mockFetch = vi.fn();

// ---- import after mocks --------------------------------------------------
import type { CatalogItem } from "@/components/sets/ForecastDashboard";
import type { LegoSet, Forecast } from "@/lib/types/lego";

function makeItem(id: string): CatalogItem {
  const product: LegoSet = {
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
  };
  const forecast: Forecast = {
    signal: "Hold",
    roiPercent: 10,
    projectedValue: 33,
    dollarGain: 3,
    annualRate: 2,
    currentPrice: 30,
    confidence: "medium",
    scenarios: {
      pessimist: { projectedValue: 30, dollarGain: 0, roiPercent: 0, annualRate: 0, signal: "Hold" },
      moderate: { projectedValue: 33, dollarGain: 3, roiPercent: 10, annualRate: 2, signal: "Hold" },
      optimist: { projectedValue: 36, dollarGain: 6, roiPercent: 20, annualRate: 4, signal: "Buy" },
    },
    updatedAt: "",
  };
  return { product, forecast };
}

function makeCatalogApiResponse(page: number, total: number, items: CatalogItem[]) {
  return { items, total, page, limit: 60, hasMore: (page * 60) < total };
}

describe("ForecastDashboard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    // Stub IntersectionObserver
    vi.stubGlobal("IntersectionObserver", class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders initial items from SSR without fetching", async () => {
    const { ForecastDashboard } = await import("@/components/sets/ForecastDashboard");
    const initialItems = [makeItem("1"), makeItem("2"), makeItem("3")];

    render(
      React.createElement(ForecastDashboard, {
        initialItems,
        initialTotal: 3,
      })
    );

    expect(screen.getAllByTestId("forecast-card")).toHaveLength(3);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows correct set counts in header", async () => {
    const { ForecastDashboard } = await import("@/components/sets/ForecastDashboard");
    const initialItems = Array.from({ length: 5 }, (_, i) => makeItem(String(i + 1)));

    render(
      React.createElement(ForecastDashboard, {
        initialItems,
        initialTotal: 100,
      })
    );

    // Shows "X of Y sets" — total should reflect initialTotal
    const counts = screen.getAllByText("100");
    expect(counts.length).toBeGreaterThan(0);
  });

  it("fetches next page when load-more triggered and appends items", async () => {
    const { ForecastDashboard } = await import("@/components/sets/ForecastDashboard");
    const initialItems = Array.from({ length: 3 }, (_, i) => makeItem(String(i + 1)));
    const page2Items = [makeItem("4"), makeItem("5")];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeCatalogApiResponse(2, 5, page2Items),
    });

    render(
      React.createElement(ForecastDashboard, {
        initialItems,
        initialTotal: 5,
        // Expose a load-more button for easier testing
        _testForceLoadMore: true,
      })
    );

    // Click the "Load more" button
    const btn = screen.getByTestId("load-more-btn");
    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(screen.getAllByTestId("forecast-card")).toHaveLength(5);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("page=2");
  });

  it("resets to page 1 when filter changes", async () => {
    const { ForecastDashboard } = await import("@/components/sets/ForecastDashboard");
    const initialItems = Array.from({ length: 3 }, (_, i) => makeItem(String(i + 1)));
    const filteredItems = [makeItem("99")];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeCatalogApiResponse(1, 1, filteredItems),
    });

    render(
      React.createElement(ForecastDashboard, {
        initialItems,
        initialTotal: 3,
      })
    );

    // Trigger filter change via FilterSidebar mock
    const sidebar = screen.getByTestId("filter-sidebar");
    await act(async () => {
      fireEvent.click(sidebar);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    // Should fetch page=1 with the new filter
    expect(mockFetch.mock.calls[0][0]).toContain("page=1");
  });
});
