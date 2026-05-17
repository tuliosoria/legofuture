import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks must be hoisted before imports of the module under test.
// We mock the DynamoDB and dynamo helpers so no real AWS calls are made.
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>();
  return {
    ...actual,
    QueryCommand: actual.QueryCommand,
  };
});

const mockSend = vi.fn();
vi.mock("@/lib/db/dynamo", () => ({
  getDynamo: () => ({ send: mockSend }),
  getTableName: () => "test-table",
}));

import {
  loadForecastModel,
  clearModelCache,
  type ForecastModel,
} from "@/lib/db/lego-forecast-models";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModel(horizon: string): ForecastModel {
  return {
    featureNames: ["age_years"],
    baseScore: 0.1,
    trees: [{ nodeid: 0, leaf: 0.05 }],
    horizon,
    version: "test-v1",
    trainedAt: "2025-01-01T00:00:00Z",
  };
}

function makeChunk(
  horizon: string,
  payload: string,
  chunkIndex: number
): Record<string, unknown> {
  return {
    pk: `MODEL#FORECAST#${horizon}`,
    sk: `FORECAST#${horizon}#chunk#${String(chunkIndex).padStart(4, "0")}`,
    chunkData: payload,
    chunkIndex,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("loadForecastModel", () => {
  beforeEach(() => {
    clearModelCache();
    mockSend.mockReset();
  });

  afterEach(() => {
    clearModelCache();
  });

  it("returns a bundled fallback when DDB returns no chunks", async () => {
    mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

    const model = await loadForecastModel("1y");

    // Bundled placeholder has version "placeholder-v1"
    expect(model.version).toBe("placeholder-v1");
    expect(model.horizon).toBe("1y");
    expect(Array.isArray(model.trees)).toBe(true);
  });

  it("reassembles chunked JSON from DDB and returns the parsed model", async () => {
    const expected = makeModel("5y");
    const fullJson = JSON.stringify(expected);

    // Split into 2 chunks to test reassembly
    const mid = Math.floor(fullJson.length / 2);
    const chunk0 = makeChunk("5y", fullJson.slice(0, mid), 0);
    const chunk1 = makeChunk("5y", fullJson.slice(mid), 1);

    // First call returns page 1 with LastEvaluatedKey to trigger pagination
    mockSend
      .mockResolvedValueOnce({
        Items: [chunk0],
        LastEvaluatedKey: { pk: "MODEL#FORECAST#5y", sk: "cursor" },
      })
      .mockResolvedValueOnce({ Items: [chunk1], LastEvaluatedKey: undefined });

    const model = await loadForecastModel("5y");

    expect(model.version).toBe("test-v1");
    expect(model.horizon).toBe("5y");
    expect(model.baseScore).toBe(0.1);
    expect(model.trees).toHaveLength(1);
    expect(model.trees[0].leaf).toBe(0.05);
  });

  it("caches the model within TTL so DDB is not re-queried", async () => {
    mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

    await loadForecastModel("3y");
    await loadForecastModel("3y");

    // DDB should have been called exactly once (first load); second returns cache
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("falls back to bundled JSON when DDB chunk JSON is invalid", async () => {
    const badChunk = makeChunk("1y", "NOT_VALID_JSON{{{", 0);
    mockSend.mockResolvedValue({ Items: [badChunk], LastEvaluatedKey: undefined });

    const model = await loadForecastModel("1y");

    expect(model.version).toBe("placeholder-v1");
  });

  it("falls back to bundled JSON when DDB chunk has invalid model shape", async () => {
    const malformed = makeChunk("1y", JSON.stringify({ not: "a valid model" }), 0);
    mockSend.mockResolvedValue({ Items: [malformed], LastEvaluatedKey: undefined });

    const model = await loadForecastModel("1y");

    expect(model.version).toBe("placeholder-v1");
  });

  it("clears cache and re-fetches on subsequent call after clearModelCache()", async () => {
    mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

    await loadForecastModel("1y");
    clearModelCache();
    await loadForecastModel("1y");

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("correctly orders out-of-order chunks during reassembly", async () => {
    const model = makeModel("3y");
    const fullJson = JSON.stringify(model);
    const third = Math.floor(fullJson.length / 3);

    const chunk2 = makeChunk("3y", fullJson.slice(third * 2), 2);
    const chunk0 = makeChunk("3y", fullJson.slice(0, third), 0);
    const chunk1 = makeChunk("3y", fullJson.slice(third, third * 2), 1);

    // DDB returns them in reverse order
    mockSend.mockResolvedValue({
      Items: [chunk2, chunk0, chunk1],
      LastEvaluatedKey: undefined,
    });

    const loaded = await loadForecastModel("3y");
    expect(loaded.version).toBe("test-v1");
    expect(loaded.baseScore).toBe(0.1);
  });
});
