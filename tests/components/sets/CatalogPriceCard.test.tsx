import React from "react";
import {describe, it, expect, vi} from "vitest";
import {render, screen, cleanup} from "@testing-library/react";
import {afterEach} from "vitest";
vi.mock("next/image", () => ({default: (p: {alt: string}) => <span>{p.alt}</span>}));
import {CatalogPriceCard} from "@/components/sets/CatalogPriceCard";
import type {LegoSet, Forecast} from "@/lib/types/lego";
afterEach(cleanup);
const product = {id:"5878738",name:"Hogwarts Castle",setNumber:"71043",slug:"hogwarts-castle-5878738",theme:"Harry Potter"} as LegoSet;
const forecast = {currentPrice:499,priceSource:"market",screenerSignal:"Strong Buy"} as Forecast;
describe("CatalogPriceCard", () => {
  it("does not recommend an unclassified set and links only to a real curated detail", () => {
    render(<CatalogPriceCard product={product} forecast={forecast} pricing={{newPrice:499,cibPrice:null,loosePrice:null,salesVolume:null,lastFetched:"2026-11-18T07:00:00Z",observations:{newSealed:{source:"ebay-median",observedAt:"2026-11-18T07:00:00Z"},complete:null,loose:null}}}/>);
    expect(screen.getByText("Not classified")).toBeTruthy();
    expect(screen.queryByText("Strong Buy")).toBeNull();
    expect(screen.getByText(/2026-11-18/)).toBeTruthy();
    expect(screen.getByText(/ebay-median/)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/set-forecast/hp-hogwarts-castle");
  });
  it("has no broken detail link for uncatalogued products or invented market price", () => {
    render(<CatalogPriceCard product={{...product,setNumber:"999999"}} forecast={{...forecast,currentPrice:100,priceSource:"estimated"}}/>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("No observed price available")).toBeTruthy();
    expect(screen.queryByText("$100")).toBeNull();
  });
});
