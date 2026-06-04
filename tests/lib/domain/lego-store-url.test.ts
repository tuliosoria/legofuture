import { describe, expect, it } from "vitest";
import { legoStoreUrl } from "@/lib/domain/forecast";

describe("legoStoreUrl", () => {
  it("matches the canonical pattern from the spec", () => {
    expect(
      legoStoreUrl({ name: "Titanic", setNumber: "10294" }),
    ).toBe("https://www.lego.com/en-us/product/lego-titanic-10294");
  });

  it("kebab-cases multi-word names", () => {
    expect(
      legoStoreUrl({ name: "Millennium Falcon", setNumber: "75192" }),
    ).toBe("https://www.lego.com/en-us/product/lego-millennium-falcon-75192");
  });

  it("strips punctuation and collapses whitespace", () => {
    expect(
      legoStoreUrl({ name: "Lamborghini Sián FKP 37", setNumber: "42115" }),
    ).toBe("https://www.lego.com/en-us/product/lego-lamborghini-sian-fkp-37-42115");
  });

  it("converts ampersands to 'and'", () => {
    expect(
      legoStoreUrl({ name: "Pirates & Plunder", setNumber: "99999" }),
    ).toBe("https://www.lego.com/en-us/product/lego-pirates-and-plunder-99999");
  });

  it("does not produce leading or trailing dashes from edge characters", () => {
    expect(
      legoStoreUrl({ name: " The Razor Crest ", setNumber: "75331" }),
    ).toBe("https://www.lego.com/en-us/product/lego-the-razor-crest-75331");
  });
});
