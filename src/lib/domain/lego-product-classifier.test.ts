import { describe, it, expect } from "vitest";
import { inferProductType } from "./lego-product-classifier";

describe("inferProductType", () => {
  it("identifies boxed sets", () => {
    expect(inferProductType("Millennium Falcon", "75192", 7541)).toBe("Boxed Set");
    expect(inferProductType("AT-AT", "75313", 6785)).toBe("Boxed Set");
  });
  it("identifies polybags from set number prefix 30xxx", () => {
    expect(inferProductType("Mini Police Station", "30451", 54)).toBe("Polybag");
  });
  it("identifies polybags from name", () => {
    expect(inferProductType("Polybag Batman", "30611", 36)).toBe("Polybag");
  });
  it("identifies keychains", () => {
    expect(inferProductType("Batman Keychain", "853951", 1)).toBe("Keychain");
    expect(inferProductType("Iron Man Key Chain", "853706", 1)).toBe("Keychain");
    expect(inferProductType("Spider-Man Keyring", "854155", 1)).toBe("Keychain");
  });
  it("identifies watches", () => {
    expect(inferProductType("LEGO Watch Kids Buildable", "9001234", 1)).toBe("Watch");
    expect(inferProductType("Buildable Watch Ninjago", "5005698", 1)).toBe("Watch");
  });
  it("identifies plushies", () => {
    expect(inferProductType("Baby Yoda Plush", "5007459", 1)).toBe("Plush");
    expect(inferProductType("Darth Vader Plushie", "5007460", 1)).toBe("Plush");
  });
  it("identifies books", () => {
    expect(inferProductType("LEGO Activity Book with Mini Model", "5006028", 1)).toBe("Book");
    expect(inferProductType("LEGO Sticker Book", "5007590", 1)).toBe("Book");
    expect(inferProductType("Colouring Book Star Wars", "5006181", 1)).toBe("Book");
  });
  it("identifies minifigure packs (CMF series)", () => {
    expect(inferProductType("Series 21 Minifigure", "71029", 8)).toBe("Minifigure Pack");
    expect(inferProductType("CMF Series 22", "71032", 8)).toBe("Minifigure Pack");
  });
  it("identifies gear / accessories", () => {
    expect(inferProductType("Pencil Case", "5007345", 1)).toBe("Gear");
    expect(inferProductType("School Bag Ninjago", "5006430", 1)).toBe("Gear");
    expect(inferProductType("Backpack Technic", "5007902", 1)).toBe("Gear");
    expect(inferProductType("Radio LEGO City", "5003580", 1)).toBe("Gear");
    expect(inferProductType("Diary Harry Potter", "5006759", 1)).toBe("Gear");
  });
  it("defaults to Boxed Set for large piece count", () => {
    expect(inferProductType("Unknown Item", "12345", 500)).toBe("Boxed Set");
  });
  it("defaults to Unknown for tiny piece count with no pattern match", () => {
    expect(inferProductType("Mystery Item", "99999", 1)).toBe("Unknown");
  });
});
