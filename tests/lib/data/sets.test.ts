import { describe, expect, it } from "vitest";
import { LEGO_SETS } from "@/lib/data/sets";

describe("LEGO_SETS catalog", () => {
  it("contains exactly 50 sets", () => {
    expect(LEGO_SETS).toHaveLength(50);
  });

  it("has unique slugs", () => {
    const ids = LEGO_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique set numbers", () => {
    const nums = LEGO_SETS.map((s) => s.setNumber);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it("bear ≤ base ≤ bull for every set", () => {
    for (const s of LEGO_SETS) {
      expect(s.bear).toBeLessThanOrEqual(s.proj5y);
      expect(s.proj5y).toBeLessThanOrEqual(s.bull);
    }
  });

  it("score is within 0–100", () => {
    for (const s of LEGO_SETS) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it("confidence is 1–5", () => {
    for (const s of LEGO_SETS) {
      expect([1, 2, 3, 4, 5]).toContain(s.confidence);
    }
  });

  it("status is one of the three allowed values", () => {
    for (const s of LEGO_SETS) {
      expect(["Active", "Retiring soon", "Retired"]).toContain(s.status);
    }
  });

  it("signal is one of the five allowed values", () => {
    for (const s of LEGO_SETS) {
      expect(["Strong Buy", "Buy", "Watch", "Hold", "Sell"]).toContain(s.signal);
    }
  });
});
