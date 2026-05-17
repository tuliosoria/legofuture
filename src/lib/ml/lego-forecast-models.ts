import "server-only";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { unstable_cache } from "next/cache";
import { getDynamo, getTableName } from "@/lib/db/dynamo";

/**
 * ML model loader.
 *
 * Reads model artifacts written by the Python training pipeline into the
 * `legofuture-cache` DynamoDB table under:
 *
 *   pk = "MODEL#lego-ml"
 *   sk = "MANIFEST"                        → JSON manifest
 *   sk = "CHUNK#<n>"  (n = 0..totalChunks) → base64-encoded model bytes
 *
 * The XGBoost runtime is Python-only, so the Next.js side does **not**
 * execute inference. It only surfaces the manifest's headline metrics
 * (RMSE, R², sampleCount) to refine the heuristic-driven forecast
 * confidence and expose `modelVersion` in API responses. Raw bundle
 * reconstruction (`loadModelBundle`) is provided for parity with the spec
 * but is not used at request time.
 */

export class NoModelAvailableError extends Error {
  constructor(message = "No lego-ml model manifest available") {
    super(message);
    this.name = "NoModelAvailableError";
  }
}

export type ForecastHorizon = "p1yr" | "p3yr" | "p5yr";
export type ModelConfidence = "high" | "medium" | "low";

export interface HorizonMetrics {
  rmse: number;
  r2: number;
  mae?: number;
}

export interface ModelMetrics {
  p1yr: HorizonMetrics;
  p3yr: HorizonMetrics;
  p5yr: HorizonMetrics;
}

export interface ModelManifest {
  version: string;
  totalChunks: number;
  metrics: ModelMetrics;
  sampleCount: number;
  trainedAt: string;
  features?: string[];
}

export interface ModelManifestSummary {
  version: string | null;
  metrics: ModelMetrics | null;
  sampleCount: number;
  trainedAt: string | null;
  available: boolean;
}

const MODEL_PK = "MODEL#lego-ml";
const MANIFEST_SK = "MANIFEST";
const CHUNK_PREFIX = "CHUNK#";

function isHorizonMetrics(value: unknown): value is HorizonMetrics {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.rmse === "number" && typeof v.r2 === "number";
}

function isModelMetrics(value: unknown): value is ModelMetrics {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return isHorizonMetrics(v.p1yr) && isHorizonMetrics(v.p3yr) && isHorizonMetrics(v.p5yr);
}

function parseManifest(raw: unknown): ModelManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.version !== "string" ||
    typeof r.totalChunks !== "number" ||
    typeof r.sampleCount !== "number" ||
    typeof r.trainedAt !== "string" ||
    !isModelMetrics(r.metrics)
  ) {
    return null;
  }
  return {
    version: r.version,
    totalChunks: r.totalChunks,
    sampleCount: r.sampleCount,
    trainedAt: r.trainedAt,
    metrics: r.metrics,
    features: Array.isArray(r.features) ? (r.features as string[]) : undefined,
  };
}

async function fetchManifestRaw(): Promise<ModelManifest | null> {
  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) return null;

  try {
    const result = await client.send(
      new GetCommand({
        TableName: table,
        Key: { pk: MODEL_PK, sk: MANIFEST_SK },
      })
    );
    if (!result.Item) return null;

    const dataField = result.Item.data;
    let payload: unknown = result.Item;
    if (typeof dataField === "string") {
      try {
        payload = JSON.parse(dataField);
      } catch {
        return null;
      }
    } else if (dataField && typeof dataField === "object") {
      payload = dataField;
    }
    return parseManifest(payload);
  } catch (err) {
    console.warn("lego-ml manifest fetch error:", err);
    return null;
  }
}

const getCachedManifest = unstable_cache(
  async (): Promise<ModelManifest | null> => fetchManifestRaw(),
  ["lego-ml-manifest"],
  { revalidate: 300, tags: ["lego-ml-manifest"] }
);

/**
 * Read the latest published model manifest summary. Cached for 5 minutes.
 * Returns `{ available: false, ... }` when no manifest exists rather than
 * throwing, so callers can degrade to the heuristic forecast cleanly.
 */
export async function getLatestModelManifest(): Promise<ModelManifestSummary> {
  let manifest: ModelManifest | null = null;
  try {
    manifest = await getCachedManifest();
  } catch (err) {
    console.warn("lego-ml manifest cache error:", err);
  }
  if (!manifest) {
    return {
      version: null,
      metrics: null,
      sampleCount: 0,
      trainedAt: null,
      available: false,
    };
  }
  return {
    version: manifest.version,
    metrics: manifest.metrics,
    sampleCount: manifest.sampleCount,
    trainedAt: manifest.trainedAt,
    available: true,
  };
}

/**
 * Confidence band derived from training sample size and 5-year R².
 *
 * Thresholds (spec §8):
 *   high   : sampleCount ≥ 2000 AND p5yr.r2 ≥ 0.55
 *   medium : sampleCount ≥ 500  AND p5yr.r2 ≥ 0.30
 *   low    : otherwise
 */
export function getModelConfidence(
  sampleCount: number,
  metrics: ModelMetrics | null
): ModelConfidence {
  if (!metrics) return "low";
  const r2 = metrics.p5yr?.r2 ?? 0;
  if (sampleCount >= 2000 && r2 >= 0.55) return "high";
  if (sampleCount >= 500 && r2 >= 0.3) return "medium";
  return "low";
}

/**
 * Reconstruct the raw model bundle bytes from `MANIFEST` + `CHUNK#<n>`
 * rows. Provided for parity with the spec; not invoked at request time
 * because XGBoost inference is Python-only.
 */
export async function loadModelBundle(): Promise<{
  manifest: ModelManifest;
  bytes: Uint8Array;
}> {
  const manifest = await fetchManifestRaw();
  if (!manifest) {
    throw new NoModelAvailableError();
  }

  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) {
    throw new NoModelAvailableError("DynamoDB not configured");
  }

  const indices = Array.from({ length: manifest.totalChunks }, (_, i) => i);
  const chunkResults = await Promise.all(
    indices.map(async (n) => {
      const res = await client.send(
        new GetCommand({
          TableName: table,
          Key: { pk: MODEL_PK, sk: `${CHUNK_PREFIX}${n}` },
        })
      );
      const item = res.Item;
      if (!item) {
        throw new NoModelAvailableError(`Missing chunk ${n} of ${manifest.totalChunks}`);
      }
      const b64 = typeof item.data === "string" ? item.data : "";
      return { n, buf: Buffer.from(b64, "base64") };
    })
  );

  chunkResults.sort((a, b) => a.n - b.n);
  const total = chunkResults.reduce((sum, c) => sum + c.buf.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const { buf } of chunkResults) {
    out.set(buf, offset);
    offset += buf.length;
  }
  return { manifest, bytes: out };
}

// QueryCommand reserved for future chunk-range scans; reference to avoid
// unused-import lint while keeping it available for downstream callers.
void QueryCommand;

export interface ForecastFeatures {
  setId: string;
  ageYears: number;
  retired: boolean;
  pieceCount: number;
  currentPrice: number;
}

export interface ForecastPrediction {
  p1yr: number;
  p3yr: number;
  p5yr: number;
  confidence: ModelConfidence;
}

/**
 * JS-side inference is not supported (XGBoost runtime is Python-only).
 * This export exists for spec parity and always throws
 * `NoModelAvailableError`. The Next.js forecast pipeline consumes the
 * manifest metrics via {@link getLatestModelManifest} instead.
 */
export async function predictLegoForecast(
  _features: ForecastFeatures
): Promise<ForecastPrediction> {
  void _features;
  throw new NoModelAvailableError(
    "JS-side XGBoost inference is not supported; use getLatestModelManifest()"
  );
}
