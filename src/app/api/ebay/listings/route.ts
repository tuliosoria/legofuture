import { NextRequest, NextResponse } from "next/server";
import { fetchEbayListings } from "@/lib/server/ebay-listings";
import { enforceIpRateLimit } from "@/lib/db/rate-limit";

export const revalidate = 600;

const ALLOWED_SURFACES = new Set([
  "lego-detail",
  "lego-dashboard",
  "buyinglist",
]);

// Pre-launch hardening: this endpoint forwards to the eBay Browse API,
// which is rate-limited per app (not per caller). Without auth, anyone on
// the internet could loop POSTs to drain the daily Browse quota and
// silently break every listings drawer on the site. Two layers of defense:
// (1) Origin/Referer allowlist so a random page can't CSRF a logged-in
//     visitor's browser into forwarding requests, and
// (2) per-IP rate limit so even legitimate-origin callers can't grind.
const ALLOWED_ORIGINS = new Set([
  "https://www.bricksfuture.com",
  "https://bricksfuture.com",
  // Legacy domain still resolves before the 308 redirect runs in some flows
  "https://www.legofuture.com",
  "https://legofuture.com",
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://127.0.0.1:3000"]
    : []),
]);

function sanitizeCustomId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 240);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const refererOrigin = (() => {
    if (!referer) return null;
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  })();
  const sourceOrigin = origin ?? refererOrigin;
  if (!sourceOrigin || !ALLOWED_ORIGINS.has(sourceOrigin)) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const blocked = await enforceIpRateLimit(req, {
    bucket: "ebay-listings-ip",
    windowSec: 60,
    max: 10,
  });
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { keywords, productKey, surface } =
    (body ?? {}) as { keywords?: string; productKey?: string; surface?: string };

  if (typeof keywords !== "string" || keywords.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing required field: keywords" },
      { status: 400 },
    );
  }
  if (typeof productKey !== "string" || productKey.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing required field: productKey" },
      { status: 400 },
    );
  }
  if (typeof surface !== "string" || !ALLOWED_SURFACES.has(surface)) {
    return NextResponse.json(
      { success: false, error: `Unsupported surface: ${surface}` },
      { status: 400 },
    );
  }

  const customId = sanitizeCustomId(`${surface}-${productKey}`);

  try {
    const listings = await fetchEbayListings({ keywords, customId });
    return NextResponse.json({ success: true, data: { listings } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
