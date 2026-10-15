import { NextRequest, NextResponse } from "next/server";
import { loadStoredCatalog } from "@/lib/db/lego-search";
import { enforceIpRateLimit } from "@/lib/db/rate-limit";
import { coerceTheme } from "@/lib/data/lego-themes";
import type { StatusFilter } from "@/lib/domain/lego-filter";
import type { LegoTheme } from "@/lib/types/lego";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ReadonlySet<StatusFilter> = new Set([
  "all",
  "active",
  "retiring",
  "retired",
]);
function readThemes(searchParams: URLSearchParams): LegoTheme[] {
  const raw = [
    ...searchParams.getAll("theme"),
    ...searchParams.getAll("themes"),
  ]
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  // coerceTheme falls back to "Other" for anything unknown. We only want
  // an explicit "other" token to filter the Other bucket — silently
  // coercing typos like "Nonexistent" into Other would mis-filter the
  // catalog. Drop tokens whose coerced value differs from the input
  // (case-insensitive, and ignoring slug vs name differences).
  const themes = raw
    .map((token) => ({ token, coerced: coerceTheme(token) }))
    .filter(({ token, coerced }) => {
      const t = token.toLowerCase();
      if (coerced !== "Other") return true;
      return t === "other";
    })
    .map(({ coerced }) => coerced);
  return Array.from(new Set(themes));
}

export async function GET(request: NextRequest) {
  const blocked = await enforceIpRateLimit(request, {
    bucket: "set-search-ip",
    windowSec: 60,
    max: 120,
  });
  if (blocked) return blocked;

  const sp = request.nextUrl.searchParams;
  const query = sp.get("q") ?? "";
  const themes = readThemes(sp);
  const statusRaw = (sp.get("status") ?? "all") as StatusFilter;
  const status: StatusFilter = VALID_STATUSES.has(statusRaw) ? statusRaw : "all";

  const catalog = await loadStoredCatalog();
  // Preserve identity search while all valuation-dependent filters/rankings are unavailable.
  const matches = catalog.filter(product => (!query || `${product.name} ${product.setNumber} ${product.theme}`.toLowerCase().includes(query.toLowerCase())) && (!themes.length || themes.includes(product.theme)) && (status === "all" || (status === "retired" ? product.retired : status === "retiring" ? product.retiringSoon : !product.retired)));
  return NextResponse.json({total:catalog.length,matched:matches.length,sets:matches,status:"unavailable",forecast:null,rankings:null,updatedAt:null},{headers:{"Cache-Control":"no-store"}});
}
