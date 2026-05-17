import type { LegoTheme } from "@/lib/types/lego";

export interface ThemeInfo {
  value: LegoTheme;
  label: string;
  emoji: string;
}

export const LEGO_THEMES: ThemeInfo[] = [
  { value: "Star Wars", label: "Star Wars", emoji: "🚀" },
  { value: "Technic", label: "Technic", emoji: "⚙️" },
  { value: "Architecture", label: "Architecture", emoji: "🏛️" },
  { value: "Modular Buildings", label: "Modular Buildings", emoji: "🏙️" },
  { value: "Icons", label: "Icons", emoji: "🧱" },
  { value: "Ideas", label: "Ideas", emoji: "💡" },
  { value: "Harry Potter", label: "Harry Potter", emoji: "⚡" },
  { value: "Marvel", label: "Marvel", emoji: "🦸" },
  { value: "Friends", label: "Friends", emoji: "💜" },
  { value: "GWP", label: "GWP / Promo", emoji: "🎁" },
  { value: "Other", label: "Other", emoji: "📦" },
];

export const THEME_VALUES = LEGO_THEMES.map((t) => t.value);
