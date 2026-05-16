/**
 * Per-key fixed-window rate limiter backed by DynamoDB.
 * Fails open if DynamoDB is not configured.
 */

import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamo, getTableName } from "./dynamo";

export interface RateLimitOptions {
  bucket: string;
  key: string;
  windowSec: number;
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

let killSwitchWarned = false;

function getCtx() {
  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) return null;
  if (
    process.env.RATE_LIMIT_DISABLED === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    if (!killSwitchWarned) {
      killSwitchWarned = true;
      console.warn("[rate-limit] disabled in non-production via env flag");
    }
    return null;
  }
  return { client, table };
}

function windowStart(windowSec: number, now = Date.now()): number {
  const windowMs = windowSec * 1000;
  return Math.floor(now / windowMs) * windowMs;
}

export async function checkRateLimit(
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const ctx = getCtx();
  const start = windowStart(opts.windowSec);
  const expiresAt = Math.floor((start + opts.windowSec * 1000) / 1000);

  if (!ctx) {
    return { ok: true, remaining: opts.max, resetAt: expiresAt * 1000 };
  }

  try {
    const res = await ctx.client.send(
      new UpdateCommand({
        TableName: ctx.table,
        Key: {
          pk: `RATELIMIT#${opts.bucket}#${opts.key}`,
          sk: String(start),
        },
        UpdateExpression: "ADD #count :one SET #ttl = :ttl",
        ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":one": 1, ":ttl": expiresAt },
        ReturnValues: "ALL_NEW",
      })
    );
    const count = Number(res.Attributes?.count ?? 1);
    const remaining = Math.max(0, opts.max - count);
    return { ok: count <= opts.max, remaining, resetAt: expiresAt * 1000 };
  } catch (err) {
    console.warn("rate-limit error (failing open):", err);
    return { ok: true, remaining: opts.max, resetAt: expiresAt * 1000 };
  }
}

export function getClientIp(req: Request): string {
  const cfViewer = req.headers.get("cloudfront-viewer-address");
  if (cfViewer) {
    const trimmed = cfViewer.trim();
    if (trimmed.startsWith("[")) {
      const close = trimmed.indexOf("]");
      if (close > 0) return trimmed.slice(1, close) || "unknown";
    }
    const lastColon = trimmed.lastIndexOf(":");
    if (lastColon > 0) {
      const after = trimmed.slice(lastColon + 1);
      if (/^\d{1,5}$/.test(after)) {
        return trimmed.slice(0, lastColon) || "unknown";
      }
    }
    return trimmed || "unknown";
  }
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function enforceIpRateLimit(
  req: Request,
  opts: Omit<RateLimitOptions, "key">
): Promise<Response | null> {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({ ...opts, key: ip });
  if (rl.ok) return null;
  return new Response(JSON.stringify({ error: "rate limited" }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-cache, no-store, must-revalidate",
      "retry-after": String(
        Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))
      ),
    },
  });
}
