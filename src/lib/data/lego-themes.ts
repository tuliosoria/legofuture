import type { LegoEra, LegoTheme } from "@/lib/types/lego";

export interface ThemeMeta {
  /** slug, lowercase */
  id: string;
  /** display name */
  name: LegoTheme;
  era: LegoEra;
  /** tailwind color e.g. "amber" | "blue" | "red" */
  colorToken: string;
  /** legacy emoji used by some UI surfaces */
  emoji?: string;
}

export const LEGO_THEMES: ThemeMeta[] = [
  { id: "technic", name: "Technic", era: "Modern", colorToken: "orange", emoji: "⚙️" },
  { id: "star-wars", name: "Star Wars", era: "Licensed", colorToken: "red", emoji: "🚀" },
  { id: "icons", name: "Icons", era: "Premium", colorToken: "amber", emoji: "🧱" },
  { id: "creator-expert", name: "Creator Expert", era: "Premium", colorToken: "amber", emoji: "🧱" },
  { id: "ideas", name: "Ideas", era: "Premium", colorToken: "purple", emoji: "💡" },
  { id: "city", name: "City", era: "Classic", colorToken: "blue", emoji: "🏙️" },
  { id: "architecture", name: "Architecture", era: "Premium", colorToken: "stone", emoji: "🏛️" },
  { id: "botanical", name: "Botanical", era: "Modern", colorToken: "emerald", emoji: "🌿" },
  { id: "seasonal", name: "Seasonal", era: "Classic", colorToken: "rose", emoji: "🎄" },
  { id: "modular-buildings", name: "Modular Buildings", era: "Premium", colorToken: "amber", emoji: "🏙️" },
  { id: "harry-potter", name: "Harry Potter", era: "Licensed", colorToken: "violet", emoji: "⚡" },
  { id: "marvel", name: "Marvel", era: "Licensed", colorToken: "red", emoji: "🦸" },
  { id: "dc", name: "DC", era: "Licensed", colorToken: "blue", emoji: "🦸" },
  { id: "minecraft", name: "Minecraft", era: "Licensed", colorToken: "emerald", emoji: "⛏️" },
  { id: "friends", name: "Friends", era: "Modern", colorToken: "pink", emoji: "💜" },
  { id: "disney", name: "Disney", era: "Licensed", colorToken: "indigo", emoji: "🏰" },
  { id: "speed-champions", name: "Speed Champions", era: "Modern", colorToken: "sky", emoji: "🏎️" },
  { id: "ninjago", name: "Ninjago", era: "Modern", colorToken: "lime", emoji: "🥷" },
];

export const THEME_VALUES: LegoTheme[] = LEGO_THEMES.map((t) => t.name);

export function coerceTheme(input: string | undefined): LegoTheme {
  if (!input) return "Other";
  const needle = input.toLowerCase();
  const found = LEGO_THEMES.find(
    (t) => t.name.toLowerCase() === needle || t.id === needle
  );
  return found?.name ?? "Other";
}

export function eraFor(theme: LegoTheme): LegoEra {
  return LEGO_THEMES.find((t) => t.name === theme)?.era ?? "Modern";
}
