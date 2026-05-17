import "server-only";

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import bundled1y from "@/lib/db/bundled/lego-forecast-1y.json";
import bundled3y from "@/lib/db/bundled/lego-forecast-3y.json";
import bundled5y from "@/lib/db/bundled/lego-forecast-5y.json";
import { getDynamo, getTableName } from "./dynamo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface XGBoostTree {
  nodeid: number;
  split?: string;
  split_condition?: number;
  children?: XGBoostTree[];
  leaf?: number;
  yes?: number;
  no?: number;
  missing?: number;
}

export interface ForecastModel {
  featureNames: string[];
  baseScore: number;
  trees: XGBoostTree[];
  horizon: string;
  version: string;
  trainedAt: string;
}

// ---------------------------------------------------------------------------
// DDB key helpers
// ---------------------------------------------------------------------------

export type ForecastHorizon = "1y" | "3y" | "5y";

const HORIZONS: ForecastHorizon[] = ["1y", "3y", "5y"];

function modelPk(horizon: ForecastHorizon): string {
  return `MODEL#FORECAST#${horizon}`;
}

function chunkSkPrefix(horizon: ForecastHorizon): string {
  return `FORECAST#${horizon}#chunk#`;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000;

const modelCache = new Map<
  ForecastHorizon,
  { model: ForecastModel; expiresAt: number }
>();

export function clearModelCache(): void {
  modelCache.clear();
}

// ---------------------------------------------------------------------------
// Bundled fallbacks
// ---------------------------------------------------------------------------

const BUNDLED: Record<ForecastHorizon, ForecastModel> = {
  "1y": bundled1y as unknown as ForecastModel,
  "3y": bundled3y as unknown as ForecastModel,
  "5y": bundled5y as unknown as ForecastModel,
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isXGBoostTree(v: unknown): v is XGBoostTree {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  if (typeof t.nodeid !== "number") return false;
  if ("leaf" in t) return typeof t.leaf === "number";
  return (
    typeof t.split === "string" &&
    typeof t.split_condition === "number" &&
    typeof t.yes === "number" &&
    typeof t.no === "number" &&
    Array.isArray(t.children)
  );
}

function validateForecastModel(raw: unknown): ForecastModel | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    !Array.isArray(r.featureNames) ||
    typeof r.baseScore !== "number" ||
    !Array.isArray(r.trees) ||
    typeof r.horizon !== "string" ||
    typeof r.version !== "string" ||
    typeof r.trainedAt !== "string"
  ) {
    return null;
  }
  if (!r.trees.every(isXGBoostTree)) return null;
  return {
    featureNames: r.featureNames as string[],
    baseScore: r.baseScore,
    trees: r.trees as XGBoostTree[],
    horizon: r.horizon,
    version: r.version,
    trainedAt: r.trainedAt,
  };
}

// ---------------------------------------------------------------------------
// DDB loader
// ---------------------------------------------------------------------------

async function loadFromDdb(horizon: ForecastHorizon): Promise<ForecastModel | null> {
  const dynamo = getDynamo();
  const table = getTableName();
  if (!dynamo || !table) return null;

  const chunks: Array<{ chunkData?: string; chunkIndex?: number }> = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  try {
    do {
      const page = await dynamo.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: {
            ":pk": modelPk(horizon),
            ":prefix": chunkSkPrefix(horizon),
          },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      chunks.push(
        ...((page.Items as Array<{ chunkData?: string; chunkIndex?: number }>) ?? [])
      );
      exclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);
  } catch (err) {
    console.warn(`[lego-forecast-models] DDB query failed for ${horizon}:`, err);
    return null;
  }

  if (chunks.length === 0) return null;

  const payload = chunks
    .sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0))
    .map((c) => c.chunkData ?? "")
    .join("");

  if (!payload) return null;

  try {
    return validateForecastModel(JSON.parse(payload));
  } catch {
    console.warn(`[lego-forecast-models] Failed to parse model JSON for ${horizon}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the XGBoost forecast model for the given horizon.
 *
 * Strategy:
 *  1. Return cached model if still within TTL.
 *  2. Query DDB chunks, reassemble JSON, validate.
 *  3. Fall back to bundled placeholder JSON if DDB misses or errors.
 *
 * The bundled placeholder emits ~10% annual growth so the system remains
 * functional even without a trained model in DDB.
 */
export async function loadForecastModel(horizon: ForecastHorizon): Promise<ForecastModel> {
  const cached = modelCache.get(horizon);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.model;
  }

  const ddbModel = await loadFromDdb(horizon);
  const model = ddbModel ?? BUNDLED[horizon];

  modelCache.set(horizon, { model, expiresAt: Date.now() + CACHE_TTL_MS });
  return model;
}

/**
 * Preload all three horizon models in parallel (optional warm-up).
 */
export async function preloadAllModels(): Promise<Record<ForecastHorizon, ForecastModel>> {
  const [m1y, m3y, m5y] = await Promise.all(
    HORIZONS.map((h) => loadForecastModel(h))
  );
  return { "1y": m1y, "3y": m3y, "5y": m5y };
}
