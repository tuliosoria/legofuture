import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockSend = vi.fn();
vi.mock("@/lib/db/dynamo", () => ({
  getDynamo: () => ({ send: mockSend }),
  getTableName: () => "legofuture-cache",
}));

import { loadStoredCatalog } from "@/lib/db/lego-search";

describe("loadStoredCatalog", () => {
  beforeEach(() => mockSend.mockReset());
  it("returns all CATALOG rows via Scan pagination", async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ id: "75192", name: "Falcon", pricingProviderCount: 2 }], LastEvaluatedKey: { pk: "x" } })
      .mockResolvedValueOnce({ Items: [{ id: "10299", name: "Real Madrid", pricingProviderCount: 1 }], LastEvaluatedKey: undefined });
    const res = await loadStoredCatalog({ includeOrphans: true });
    expect(res).toHaveLength(2);
  });
  it("filters out non-eligible by default", async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { id: "A", pricingProviderCount: 2, pieceCount: 100, originalMsrp: 29.99 },
      { id: "B", pricingProviderCount: 0, pieceCount: 100, originalMsrp: 29.99 },
    ], LastEvaluatedKey: undefined });
    const res = await loadStoredCatalog();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(res.map((r: any) => r.id)).toEqual(["A"]);
  });
});
