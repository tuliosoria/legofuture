import React from "react";
import {describe, it, expect, vi} from "vitest";
import {render, screen} from "@testing-library/react";
vi.mock("@/components/sets/ForecastDashboard", () => ({ForecastDashboard: (props: {loadOnMount?: boolean; includeOrphans?: boolean}) => <div data-testid="catalog-dashboard">{props.loadOnMount && props.includeOrphans === false ? "live priced catalog" : "invalid configuration"}</div>}));
import CatalogPage from "@/app/catalog/page";
describe("public catalog page", () => {
  it("mounts the live catalog and distinguishes coverage from investment approval", () => {
    render(<CatalogPage />);
    expect(screen.getByRole("heading", {name: "Price catalog"})).toBeTruthy();
    expect(screen.getByText("live priced catalog")).toBeTruthy();
    expect(screen.getByText(/not an investment recommendation/i)).toBeTruthy();
    expect(screen.queryByText(/asking prices/i)).toBeNull();
    expect(screen.getByText(/Forecasts are estimates/)).toBeTruthy();
  });
});
