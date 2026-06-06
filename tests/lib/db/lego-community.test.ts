import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { blendCommunityScore } from "@/lib/db/lego-community";

describe("blendCommunityScore", () => {
  it("returns null when all three components are missing", () => {
    expect(
      blendCommunityScore({ brickInsights: null, trends: null, reddit: null })
    ).toBeNull();
  });

  it("uses default 50/25/25 weights when all three components present", () => {
    // 0.5 * 80 + 0.25 * 60 + 0.25 * 40 = 40 + 15 + 10 = 65
    expect(
      blendCommunityScore({ brickInsights: 80, trends: 60, reddit: 40 })
    ).toBe(65);
  });

  it("redistributes weight pro-rata when reddit is missing", () => {
    // BI default 0.5, Trends default 0.25, total = 0.75
    // (0.5/0.75)*80 + (0.25/0.75)*60 = 53.33 + 20 = 73.33 → 73
    expect(
      blendCommunityScore({ brickInsights: 80, trends: 60, reddit: null })
    ).toBe(73);
  });

  it("redistributes weight pro-rata when only brick insights is present", () => {
    expect(
      blendCommunityScore({ brickInsights: 70, trends: null, reddit: null })
    ).toBe(70);
  });

  it("redistributes weight pro-rata when only reddit is present", () => {
    expect(
      blendCommunityScore({ brickInsights: null, trends: null, reddit: 50 })
    ).toBe(50);
  });

  it("clamps weighted output to integer 0-100 range", () => {
    expect(
      blendCommunityScore({ brickInsights: 100, trends: 100, reddit: 100 })
    ).toBe(100);
    expect(
      blendCommunityScore({ brickInsights: 0, trends: 0, reddit: 0 })
    ).toBe(0);
  });

  it("rounds to nearest integer", () => {
    // 0.5*55 + 0.25*60 + 0.25*60 = 27.5 + 15 + 15 = 57.5 → 58
    expect(
      blendCommunityScore({ brickInsights: 55, trends: 60, reddit: 60 })
    ).toBe(58);
  });
});
