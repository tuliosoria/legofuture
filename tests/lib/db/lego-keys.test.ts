import { describe, it, expect } from "vitest";
import { catalogPk, pricingPk, historyPk, historySk, modelChunkSk, syncMetaPk } from "@/lib/db/lego-keys";

describe("lego-keys", () => {
  it("builds CATALOG pk", () => {
    expect(catalogPk("75192")).toBe("CATALOG#PRODUCT#75192");
  });
  it("builds PRICING pk", () => {
    expect(pricingPk("75192")).toBe("PRICING#PRODUCT#75192");
  });
  it("builds HISTORY pk + monthly sk", () => {
    expect(historyPk("75192")).toBe("HISTORY#PRODUCT#75192");
    expect(historySk("bricklink-new", new Date("2026-03-15T00:00:00Z"))).toBe("bricklink-new#2026-03");
  });
  it("builds MODEL chunk sk", () => {
    expect(modelChunkSk("3yr", 7)).toBe("FORECAST#3yr#chunk#0007");
  });
  it("builds SYNC meta pk", () => {
    expect(syncMetaPk("rebrickable", "2026-05-17T03:00:00Z")).toBe("META#SYNC#rebrickable#2026-05-17T03:00:00Z");
  });
});
