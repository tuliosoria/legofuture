import type { CachedEbayToken, EbayOAuthTokenResponse } from "./types";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SCOPE = "https://api.ebay.com/oauth/api_scope";
const SAFETY_MARGIN_MS = 60_000;

let cache: CachedEbayToken | null = null;

export function __resetTokenCacheForTests(): void {
  cache = null;
}

export async function getEbayAccessToken(): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt - SAFETY_MARGIN_MS > now) {
    return cache.accessToken;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId) throw new Error("EBAY_CLIENT_ID is not set");
  if (!clientSecret) throw new Error("EBAY_CLIENT_SECRET is not set");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: SCOPE,
  }).toString();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`eBay OAuth failed: HTTP ${res.status} ${text}`);
  }

  const data = (await res.json()) as EbayOAuthTokenResponse;
  cache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cache.accessToken;
}
