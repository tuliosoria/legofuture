#!/usr/bin/env node
/**
 * scripts/sync-reddit-mentions.mjs
 *
 * Pulls LEGO-set conversation volume from Reddit and writes
 * `REDDIT#<setNumber>` / `<yyyymm>` rows to the legofuture-cache table.
 * One row per (set, month) summarising a trailing-12-month window across
 * LEGO-specific subreddits.
 *
 * AUTH: Reddit blocks anonymous JSON requests from server/cloud IPs as
 * of 2023. This script uses the OAuth `client_credentials` grant. To
 * enable, register a "script" app at https://www.reddit.com/prefs/apps
 * (free, takes 2 minutes) and set:
 *
 *   REDDIT_CLIENT_ID     — the 14-char public key shown under the app name
 *   REDDIT_CLIENT_SECRET — the longer secret string
 *   REDDIT_USER_AGENT    — optional override; defaults to the constant below
 *
 * Without credentials the script exits 0 with a LIMITATIONS row so the
 * rest of the pipeline can keep running. The downstream community-score
 * adapter is designed to redistribute weight to Brick Insights + Google
 * Trends when REDDIT rows are missing.
 *
 * Source contract:
 *   - POST https://www.reddit.com/api/v1/access_token  (token, 1hr TTL)
 *   - GET  https://oauth.reddit.com/r/<sub>/search.json?q=<term>
 *          &restrict_sr=on&sort=new&t=year&limit=100
 *   - Aggregate posts across the SUBREDDITS list.
 *   - Throttle THROTTLE_MS between requests; back off on 429/503.
 *
 * Signal definition (per (set, month) row):
 *   - postCount    : number of distinct posts found in the trailing 12mo
 *   - totalScore   : sum of post.score (net upvotes)
 *   - avgScore     : totalScore / max(postCount, 1)
 *   - composite    : postCount * ln(avgScore + 1)
 *     The composite balances volume (post count) and intensity (avg karma),
 *     so a single viral post can't dominate and a flood of zero-upvote
 *     chatter is down-weighted.
 *
 * The composite is normalised to 0-100 at *read time* in the live adapter
 * (relative to the catalogue's per-month distribution), so this script
 * only writes raw counts.
 *
 * Schema:
 *   pk = "REDDIT#<setNumber>"  sk = "<yyyymm>"
 *     { postCount, totalScore, avgScore, composite,
 *       capturedAt, source: "reddit-oauth-search",
 *       term, subreddits: [...] }
 *   pk = "META"                sk = "SYNC_METADATA#<ISO>"
 *   pk = "META"                sk = "LIMITATIONS#<ISO>"
 *
 * Usage:
 *   AWS_REGION=us-east-1 DYNAMODB_TABLE=legofuture-cache \
 *   REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=... \
 *     node --env-file=.env.local scripts/sync-reddit-mentions.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "../src/lib/data/lego-ml/lego-catalog.json");

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const USER_AGENT =
  process.env.REDDIT_USER_AGENT ||
  "legofuture-sync-reddit/1.0 (by /u/legofuture; +https://legofuture.app)";
const THROTTLE_MS = 1500;
const SUBREDDITS = ["lego", "legoinvesting", "legodeal"];

const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function yyyymm(date) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

async function loadCatalog() {
  console.log(`📚 Scanning DynamoDB for CATALOG#PRODUCT# rows...`);
  const items = [];
  let ExclusiveStartKey;
  try {
    do {
      const res = await ddb.send(
        new ScanCommand({
          TableName: TABLE,
          FilterExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: { ":pk": "CATALOG", ":sk": "PRODUCT#" },
          ExclusiveStartKey,
        })
      );
      items.push(...(res.Items || []));
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);
  } catch (err) {
    console.warn(`   DDB scan failed: ${err.message}`);
  }
  if (items.length > 0) {
    const usable = items
      .map((i) => ({
        id: i.id ?? i.sk?.replace("PRODUCT#", ""),
        setNumber: i.setNumber,
        name: i.name,
        theme: i.themeName ?? i.theme,
      }))
      .filter((s) => s.setNumber && s.name);
    console.log(`   Loaded ${usable.length} sets from DynamoDB`);
    if (usable.length > 0) return usable;
  }
  console.log(`   Falling back to ${CATALOG_PATH}`);
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  console.log(`   Loaded ${catalog.length} sets from JSON`);
  return catalog;
}

function buildTerm(set) {
  // Quote the set number so Reddit treats it as a token.
  return `"${set.setNumber}"`;
}

async function fetchAccessToken() {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`token ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error("token response missing access_token");
  return json.access_token;
}

async function fetchSubredditPosts(sub, term, token, attempt = 0) {
  const url =
    `https://oauth.reddit.com/r/${encodeURIComponent(sub)}/search.json` +
    `?q=${encodeURIComponent(term)}&restrict_sr=on&sort=new&t=year&limit=100`;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
      },
    });
  } catch (err) {
    if (attempt < 2) {
      await sleep(2000 * (attempt + 1));
      return fetchSubredditPosts(sub, term, token, attempt + 1);
    }
    throw err;
  }
  if (res.status === 429 || res.status === 503) {
    if (attempt < 3) {
      const backoff = 5000 * (attempt + 1);
      console.warn(`   ${sub}: ${res.status}, backing off ${backoff}ms`);
      await sleep(backoff);
      return fetchSubredditPosts(sub, term, token, attempt + 1);
    }
    throw new Error(`reddit ${sub} ${res.status} after retries`);
  }
  if (!res.ok) {
    throw new Error(`reddit ${sub} ${res.status}`);
  }
  const body = await res.json();
  const children = body?.data?.children ?? [];
  return children.map((c) => c?.data).filter(Boolean);
}

async function fetchSetSignal(set, token) {
  const term = buildTerm(set);
  const all = [];
  for (const sub of SUBREDDITS) {
    try {
      const posts = await fetchSubredditPosts(sub, term, token);
      all.push(...posts);
    } catch (err) {
      console.warn(`   ${set.setNumber} ${sub}: ${err.message}`);
    }
    await sleep(THROTTLE_MS);
  }
  const seen = new Set();
  const unique = all.filter((p) => {
    const id = p.id ?? p.name;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const oneYearAgoUtc = Math.floor((Date.now() - 365 * 24 * 3600 * 1000) / 1000);
  const recent = unique.filter((p) => (p.created_utc ?? 0) >= oneYearAgoUtc);
  const postCount = recent.length;
  const totalScore = recent.reduce((s, p) => s + Math.max(0, p.score ?? 0), 0);
  const avgScore = postCount > 0 ? totalScore / postCount : 0;
  const composite = postCount * Math.log(avgScore + 1);
  return { postCount, totalScore, avgScore, composite, term };
}

async function writeLimitationsAndExit(reason) {
  const finishedAt = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: "META",
        sk: `LIMITATIONS#${finishedAt}`,
        script: "sync-reddit-mentions",
        note: reason,
        capturedAt: finishedAt,
      },
    })
  );
  console.warn(`⚠ ${reason}`);
  console.warn(
    "  Set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET in .env.local. " +
      "Register a free 'script' app at https://www.reddit.com/prefs/apps."
  );
}

async function run() {
  const startedAt = new Date().toISOString();
  console.log(`\n📊 Reddit mentions sync — started ${startedAt}`);
  console.log(`   table=${TABLE} region=${REGION}`);
  console.log(`   subreddits=${SUBREDDITS.join(", ")} throttle=${THROTTLE_MS}ms`);

  if (!CLIENT_ID || !CLIENT_SECRET) {
    await writeLimitationsAndExit(
      "Reddit OAuth credentials not configured; skipping sync."
    );
    return;
  }

  let token;
  try {
    token = await fetchAccessToken();
    console.log(`   ✓ acquired Reddit OAuth token`);
  } catch (err) {
    await writeLimitationsAndExit(
      `Reddit OAuth token request failed: ${err.message}`
    );
    return;
  }

  const catalog = await loadCatalog();
  const yyyymmNow = yyyymm(new Date());
  let written = 0;
  const missing = [];

  for (const set of catalog) {
    if (!set.setNumber) {
      missing.push({ id: set.id, reason: "no setNumber" });
      continue;
    }
    try {
      const sig = await fetchSetSignal(set, token);
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            pk: `REDDIT#${set.setNumber}`,
            sk: yyyymmNow,
            postCount: sig.postCount,
            totalScore: sig.totalScore,
            avgScore: Number(sig.avgScore.toFixed(2)),
            composite: Number(sig.composite.toFixed(4)),
            term: sig.term,
            subreddits: SUBREDDITS,
            capturedAt: new Date().toISOString(),
            source: "reddit-oauth-search",
          },
        })
      );
      written += 1;
      console.log(
        `   ✓ ${set.setNumber} ${set.name}: ` +
          `posts=${sig.postCount} avg=${sig.avgScore.toFixed(1)} ` +
          `composite=${sig.composite.toFixed(2)}`
      );
    } catch (err) {
      missing.push({ setNumber: set.setNumber, name: set.name, reason: err.message });
      console.warn(`   ⚠ ${set.setNumber} ${set.name}: ${err.message}`);
    }
  }

  const finishedAt = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: "META",
        sk: `SYNC_METADATA#${finishedAt}`,
        script: "sync-reddit-mentions",
        sets_processed: catalog.length,
        scores_written: written,
        missing_count: missing.length,
        startedAt,
        finishedAt,
      },
    })
  );
  if (missing.length > 0) {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: "META",
          sk: `LIMITATIONS#${finishedAt}`,
          script: "sync-reddit-mentions",
          missing_sets: missing.slice(0, 100),
          note: "Reddit search returned no results or errored.",
          capturedAt: finishedAt,
        },
      })
    );
  }

  console.log(`\n✅ Reddit sync complete: ${written} written, ${missing.length} missing`);
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
