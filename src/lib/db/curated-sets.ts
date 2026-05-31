import "server-only";

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamo, getTableName } from "./dynamo";
import {
  curatedScoresPk,
  voteIpPk,
  voteIpSk,
  CURATED_SCORES_SK,
} from "./lego-keys";
import type { CuratedScores } from "@/lib/types/curated";

function ctx() {
  const c = getDynamo();
  const t = getTableName();
  if (!c || !t) return null;
  return { c, t };
}

/** Load scores for a single set from DDB. Returns null if not found or DDB unavailable. */
export async function loadCuratedScores(
  setNumber: string
): Promise<CuratedScores | null> {
  const db = ctx();
  if (!db) return null;
  try {
    const res = await db.c.send(
      new GetCommand({
        TableName: db.t,
        Key: { pk: curatedScoresPk(setNumber), sk: CURATED_SCORES_SK },
      })
    );
    if (!res.Item) return null;
    return {
      setNumber,
      bricklinkSoldCount6mo: res.Item.bricklinkSoldCount6mo ?? null,
      retirementMonthsRemaining: res.Item.retirementMonthsRemaining ?? null,
      currentPrice: res.Item.currentPrice ?? null,
      voteCount: res.Item.voteCount ?? 0,
      lastRefreshed: res.Item.lastRefreshed ?? "",
    };
  } catch (err) {
    console.warn("[curated-sets] loadCuratedScores error:", err);
    return null;
  }
}

/** Load scores for multiple sets in one BatchGet. Missing sets get a zero-score fallback. */
export async function loadAllCuratedScores(
  setNumbers: string[]
): Promise<Map<string, CuratedScores>> {
  const result = new Map<string, CuratedScores>();
  const db = ctx();

  for (const sn of setNumbers) {
    result.set(sn, {
      setNumber: sn,
      bricklinkSoldCount6mo: null,
      retirementMonthsRemaining: null,
      currentPrice: null,
      voteCount: 0,
      lastRefreshed: "",
    });
  }

  if (!db || setNumbers.length === 0) return result;

  const chunks: string[][] = [];
  for (let i = 0; i < setNumbers.length; i += 25) {
    chunks.push(setNumbers.slice(i, i + 25));
  }

  try {
    for (const chunk of chunks) {
      const keys = chunk.map((sn) => ({
        pk: curatedScoresPk(sn),
        sk: CURATED_SCORES_SK,
      }));
      const res = await db.c.send(
        new BatchGetCommand({
          RequestItems: { [db.t]: { Keys: keys } },
        })
      );
      for (const item of res.Responses?.[db.t] ?? []) {
        const sn = (item.pk as string).replace("CURATED#SET#", "");
        result.set(sn, {
          setNumber: sn,
          bricklinkSoldCount6mo: item.bricklinkSoldCount6mo ?? null,
          retirementMonthsRemaining: item.retirementMonthsRemaining ?? null,
          currentPrice: item.currentPrice ?? null,
          voteCount: item.voteCount ?? 0,
          lastRefreshed: item.lastRefreshed ?? "",
        });
      }
    }
  } catch (err) {
    console.warn("[curated-sets] loadAllCuratedScores error:", err);
  }

  return result;
}

/** Check if this IP has already voted for this set (within TTL window). */
export async function hasVoted(
  hashedIp: string,
  setNumber: string
): Promise<boolean> {
  const db = ctx();
  if (!db) return false;
  try {
    const res = await db.c.send(
      new GetCommand({
        TableName: db.t,
        Key: { pk: voteIpPk(hashedIp), sk: voteIpSk(setNumber) },
      })
    );
    return !!res.Item;
  } catch {
    return false;
  }
}

/** Record a vote: write the vote dedup record + atomically increment the count on the scores row. */
export async function recordVote(
  hashedIp: string,
  setNumber: string
): Promise<number> {
  const db = ctx();
  if (!db) return 0;

  const ttlSec = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  await db.c.send(
    new PutCommand({
      TableName: db.t,
      Item: {
        pk: voteIpPk(hashedIp),
        sk: voteIpSk(setNumber),
        setNumber,
        votedAt: new Date().toISOString(),
        ttl: ttlSec,
      },
    })
  );

  const res = await db.c.send(
    new UpdateCommand({
      TableName: db.t,
      Key: { pk: curatedScoresPk(setNumber), sk: CURATED_SCORES_SK },
      UpdateExpression:
        "SET #vc = if_not_exists(#vc, :zero) + :one",
      ExpressionAttributeNames: { "#vc": "voteCount" },
      ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
      ReturnValues: "ALL_NEW",
    })
  );

  return Number(res.Attributes?.voteCount ?? 0);
}
