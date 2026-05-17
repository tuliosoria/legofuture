import type { LegoSet, LegoTheme } from "@/lib/types/lego";
import { coerceTheme } from "@/lib/data/lego-themes";

export { coerceTheme };

export function buildLegoDisplayName(set: LegoSet): string {
  if (set.setNumber && !set.name.includes(set.setNumber)) {
    return `${set.name} (${set.setNumber})`;
  }
  return set.name;
}

const THEME_ALIASES: Record<string, LegoTheme> = {
  "sw": "Star Wars",
  "starwars": "Star Wars",
  "star wars": "Star Wars",
  "tech": "Technic",
  "technic": "Technic",
  "hp": "Harry Potter",
  "harry potter": "Harry Potter",
  "modular": "Modular Buildings",
  "modulars": "Modular Buildings",
  "ucs": "Star Wars",
};

const STATUS_ALIASES: Record<string, "retired" | "active" | "retiring"> = {
  "retired": "retired",
  "retiring soon": "retiring",
  "retiring": "retiring",
  "active": "active",
  "current": "active",
  "available": "active",
};

export interface SearchAliasMatch {
  theme?: LegoTheme;
  status?: "retired" | "active" | "retiring";
  freeText: string;
}

export function buildLegoSearchAliases(rawQuery: string): SearchAliasMatch {
  const q = rawQuery.trim().toLowerCase();
  let theme: LegoTheme | undefined;
  let status: "retired" | "active" | "retiring" | undefined;
  let freeText = q;

  for (const [alias, mappedTheme] of Object.entries(THEME_ALIASES)) {
    if (q.includes(alias)) {
      theme = mappedTheme;
      freeText = freeText.replace(alias, "").trim();
      break;
    }
  }
  for (const [alias, mappedStatus] of Object.entries(STATUS_ALIASES)) {
    if (q.includes(alias)) {
      status = mappedStatus;
      freeText = freeText.replace(alias, "").trim();
      break;
    }
  }
  freeText = freeText.replace(/\bsets?\b/g, "").replace(/\s+/g, " ").trim();
  return { theme, status, freeText };
}
