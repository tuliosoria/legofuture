import { NextResponse, type NextRequest } from "next/server";

/**
 * Permanently redirect legofuture.com (the legacy brand domain) to
 * bricksfuture.com so all bookmarks and inbound links land on the live site.
 *
 * Runs at the edge for every request. We only act on the legacy host;
 * everything else passes through unchanged.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.toLowerCase() ?? "";
  if (host === "legofuture.com" || host === "www.legofuture.com") {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, "https://bricksfuture.com");
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Apply to everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
