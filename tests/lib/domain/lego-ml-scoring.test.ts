import { describe, it, expect } from "vitest";
import { scoreModel } from "@/lib/domain/lego-ml-scoring";
import type { ForecastModel } from "@/lib/db/lego-forecast-models";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/**
 * Build a two-tree XGBoost fixture:
 *
 * Tree 0:
 *   root (split on "age_years" < 5)
 *     yes=1 → leaf  0.10
 *     no=2  → leaf -0.05
 *
 * Tree 1:
 *   root (split on "piece_count_log" < 6)
 *     yes=1 → leaf  0.08
 *     no=2  → leaf  0.02
 *
 * baseScore = 0.05
 *
 * So for age_years=3, piece_count_log=5:
 *   tree0: 3 < 5 → yes(1) → leaf 0.10
 *   tree1: 5 < 6 → yes(1) → leaf 0.08
 *   total = 0.05 + 0.10 + 0.08 = 0.23
 *
 * For age_years=8, piece_count_log=7:
 *   tree0: 8 >= 5 → no(2) → leaf -0.05
 *   tree1: 7 >= 6 → no(2) → leaf  0.02
 *   total = 0.05 + (-0.05) + 0.02 = 0.02
 */
function makeTwoTreeModel(): ForecastModel {
  return {
    featureNames: ["age_years", "piece_count_log"],
    baseScore: 0.05,
    trees: [
      {
        nodeid: 0,
        split: "age_years",
        split_condition: 5,
        yes: 1,
        no: 2,
        missing: 1,
        children: [
          { nodeid: 1, leaf: 0.10 },
          { nodeid: 2, leaf: -0.05 },
        ],
      },
      {
        nodeid: 0,
        split: "piece_count_log",
        split_condition: 6,
        yes: 1,
        no: 2,
        missing: 1,
        children: [
          { nodeid: 1, leaf: 0.08 },
          { nodeid: 2, leaf: 0.02 },
        ],
      },
    ],
    horizon: "5y",
    version: "fixture-v1",
    trainedAt: "2025-01-01T00:00:00Z",
  };
}

/** Model with a single leaf tree (placeholder pattern). */
function makeSingleLeafModel(baseScore: number, leafValue: number): ForecastModel {
  return {
    featureNames: ["age_years"],
    baseScore,
    trees: [{ nodeid: 0, leaf: leafValue }],
    horizon: "1y",
    version: "leaf-fixture",
    trainedAt: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreModel", () => {
  const model = makeTwoTreeModel();

  it("routes both trees to 'yes' leaves for features below thresholds", () => {
    const features = { age_years: 3, piece_count_log: 5 };
    const score = scoreModel(model, features);
    // 0.05 + 0.10 + 0.08 = 0.23
    expect(score).toBeCloseTo(0.23, 10);
  });

  it("routes both trees to 'no' leaves for features above thresholds", () => {
    const features = { age_years: 8, piece_count_log: 7 };
    const score = scoreModel(model, features);
    // 0.05 + (-0.05) + 0.02 = 0.02
    expect(score).toBeCloseTo(0.02, 10);
  });

  it("routes to 'yes' leaf when feature equals threshold (< boundary)", () => {
    // split_condition=5, value=4.9999 → yes branch
    const features = { age_years: 4.9999, piece_count_log: 5 };
    const score = scoreModel(model, features);
    expect(score).toBeCloseTo(0.23, 5);
  });

  it("routes to 'no' leaf when feature equals split_condition exactly", () => {
    // split_condition=5, value=5 → NOT (5 < 5) → no branch
    const features = { age_years: 5, piece_count_log: 7 };
    const score = scoreModel(model, features);
    // tree0: no → -0.05; tree1: no → 0.02; total = 0.05 - 0.05 + 0.02 = 0.02
    expect(score).toBeCloseTo(0.02, 10);
  });

  it("routes to missing branch (yes) when feature is absent", () => {
    // age_years missing → missing=1 → leaf 0.10
    // piece_count_log=5 → yes → leaf 0.08
    const features = { piece_count_log: 5 }; // age_years absent
    const score = scoreModel(model, features);
    expect(score).toBeCloseTo(0.23, 10);
  });

  it("routes to missing branch when feature is NaN", () => {
    const features = { age_years: NaN, piece_count_log: 7 };
    // tree0: NaN → missing(1) → leaf 0.10; tree1: 7 ≥ 6 → no(2) → leaf 0.02
    const score = scoreModel(model, features);
    // 0.05 + 0.10 + 0.02 = 0.17
    expect(score).toBeCloseTo(0.17, 10);
  });

  it("routes to missing branch when feature is Infinity", () => {
    const features = { age_years: Infinity, piece_count_log: 5 };
    // tree0: Infinity → not finite → missing(1) → leaf 0.10; tree1: 5 < 6 → yes(1) → leaf 0.08
    const score = scoreModel(model, features);
    expect(score).toBeCloseTo(0.23, 10);
  });

  it("single-leaf model returns baseScore + leafValue for any features", () => {
    const m = makeSingleLeafModel(0.09531, 0.0);
    expect(scoreModel(m, {})).toBeCloseTo(0.09531, 5);
    expect(scoreModel(m, { age_years: 10 })).toBeCloseTo(0.09531, 5);
  });

  it("placeholder 1y model produces ~10% growth factor (exp ≈ 1.10)", () => {
    const m = makeSingleLeafModel(0.09531, 0.0);
    const growthFactor = Math.exp(scoreModel(m, {}));
    expect(growthFactor).toBeCloseTo(1.10, 2);
  });

  it("placeholder 5y model produces ~1.61 growth factor (exp ≈ 1.10^5)", () => {
    const m = makeSingleLeafModel(0.47623, 0.0);
    const growthFactor = Math.exp(scoreModel(m, {}));
    expect(growthFactor).toBeCloseTo(Math.pow(1.10, 5), 2);
  });

  it("empty trees array returns baseScore only", () => {
    const m: ForecastModel = {
      featureNames: [],
      baseScore: 0.42,
      trees: [],
      horizon: "5y",
      version: "v0",
      trainedAt: "2025-01-01T00:00:00Z",
    };
    expect(scoreModel(m, {})).toBe(0.42);
  });

  it("throws if a tree references a non-existent child node", () => {
    const badModel: ForecastModel = {
      featureNames: ["x"],
      baseScore: 0,
      trees: [
        {
          nodeid: 0,
          split: "x",
          split_condition: 1,
          yes: 99, // non-existent
          no: 2,
          missing: 2,
          children: [{ nodeid: 2, leaf: 0.5 }],
        },
      ],
      horizon: "1y",
      version: "bad",
      trainedAt: "2025-01-01T00:00:00Z",
    };
    expect(() => scoreModel(badModel, { x: 0 })).toThrow();
  });
});
