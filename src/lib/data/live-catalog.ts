import "server-only";

import { LEGO_SETS } from "@/lib/data/sets";
import { loadHistory } from "@/lib/db/lego-history";
import { loadStoredCatalog } from "@/lib/db/lego-search";
import { getPricingFromDdb } from "@/lib/domain/lego-estimate";
import { computeMlForecast } from "@/lib/domain/lego-forecast";
import type { LegoSet as MvpLegoSet } from "@/lib/domain/lego-set";
import type {
  Forecast,
  HistoryPoint,
  LegoCondition,
  LegoSet as DdbLegoSet,
  ProductPricing,
} from "@/lib/types/lego";

const CATALOG_CACHE_TTL_MS = 60_000;

let catalogCache: { value: Promise<Map<string, DdbLegoSet>>; ts: number } | null = null;

export interface LiveHistoryPoint {
  date: string;
  price: number;
  source: "real" | "synthetic_backfill";
}

export interface AdaptInput {
  curated: MvpLegoSet;
  ddbProduct: DdbLegoSet | null;
  pricing: ProductPricing | null;
  history: HistoryPoint[];
  mlForecast: Forecast | null;
}

async function scanCatalogBySetNumber(): Promise<Map<string, DdbLegoSet>> {
  const catalog = await loadStoredCatalog({ includeOrphans: true, orphanCap: 50_000 });
  const bySetNumber = new Map<string, DdbLegoSet>();
  for (const product of catalog) {
    if (product.setNumber) bySetNumber.set(product.setNumber, product);
  }
  return bySetNumber;
}

async function loadCatalogBySetNumber(): Promise<Map<string, DdbLegoSet>> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.ts < CATALOG_CACHE_TTL_MS) {
    return catalogCache.value;
  }

  const value = scanCatalogBySetNumber().catch((err) => {
    if (catalogCache?.value === value) catalogCache = null;
    throw err;
  });
  catalogCache = { value, ts: now };
  return value;
}

async function loadHistoryWithFallback(product: DdbLegoSet): Promise<HistoryPoint[]> {
  const conditions: LegoCondition[] = ["new-sealed", "complete"];
  for (const condition of conditions) {
    const history = await loadHistory(product, condition).catch(() => []);
    if (history.length > 0) {
      return [...history].sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  return [];
}

function formatPct(ratio: number): string {
  const pct = Math.round(ratio * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function normalizeDateKey(date: string): string {
  return date.slice(0, 10);
}

function computeMomentum(history: HistoryPoint[]): string | null {
  if (history.length < 2) return null;

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  if (!latest || latest.price <= 0) return null;

  const latestDate = new Date(`${normalizeDateKey(latest.date)}T00:00:00.000Z`);
  if (Number.isNaN(latestDate.getTime())) return null;
  const target = new Date(latestDate);
  target.setUTCFullYear(target.getUTCFullYear() - 1);
  const targetKey = target.toISOString().slice(0, 10);

  const yearAgo =
    sorted.find((point) => normalizeDateKey(point.date) === targetKey) ??
    sorted.findLast((point) => normalizeDateKey(point.date) <= targetKey);

  if (!yearAgo || yearAgo.price <= 0) return null;
  return `${formatPct((latest.price - yearAgo.price) / yearAgo.price)} 12mo`;
}

function pickCurrentPrice(pricing: ProductPricing | null, fallback: number): number {
  const price = pricing?.newPrice;
  return price && price > 0 ? Math.round(price) : fallback;
}

function statusFromProduct(product: DdbLegoSet | null, fallback: MvpLegoSet["status"]): MvpLegoSet["status"] {
  if (!product) return fallback;
  if (product.retiringSoon) return "Retiring soon";
  return product.retired ? "Retired" : "Active";
}

export function toMvpLegoSet(input: AdaptInput): MvpLegoSet {
  const { curated, ddbProduct, pricing, history, mlForecast } = input;
  const hasLiveData = ddbProduct !== null || pricing !== null || history.length > 0 || mlForecast !== null;
  if (!hasLiveData) return { ...curated };

  const momentum = computeMomentum(history);
  const currentPrice = pickCurrentPrice(pricing, curated.currentPrice);
  const proj5y = mlForecast?.scenarios?.moderate?.projectedValue ?? curated.proj5y;
  const bear = mlForecast?.scenarios?.pessimist?.projectedValue ?? curated.bear;
  const bull = mlForecast?.scenarios?.optimist?.projectedValue ?? curated.bull;

  return {
    ...curated,
    name: ddbProduct?.name ?? curated.name,
    setNumber: ddbProduct?.setNumber ?? curated.setNumber,
    theme: (ddbProduct?.theme as MvpLegoSet["theme"] | undefined) ?? curated.theme,
    year: ddbProduct?.releaseYear ?? curated.year,
    status: statusFromProduct(ddbProduct, curated.status),
    msrp: ddbProduct?.originalMsrp ? Math.round(ddbProduct.originalMsrp) : curated.msrp,
    currentPrice,
    proj5y: Math.round(proj5y),
    bear: Math.round(bear),
    bull: Math.round(bull),
    pieces: ddbProduct?.pieceCount ?? curated.pieces,
    momentum: (momentum ?? curated.momentum) as MvpLegoSet["momentum"],
    thesis: curated.thesis,
  };
}

async function adaptCuratedSet(curated: MvpLegoSet, ddbProduct: DdbLegoSet | null): Promise<MvpLegoSet> {
  if (!ddbProduct) {
    return toMvpLegoSet({ curated, ddbProduct: null, pricing: null, history: [], mlForecast: null });
  }

  const [pricing, history] = await Promise.all([
    getPricingFromDdb(ddbProduct).catch(() => null),
    loadHistoryWithFallback(ddbProduct),
  ]);
  const hasMarketPrice = Boolean(pricing?.newPrice ?? pricing?.cibPrice ?? pricing?.loosePrice);
  const canForecast = ddbProduct.forecastEligible !== false && (hasMarketPrice || ddbProduct.originalMsrp > 0);
  const mlForecast = canForecast
    ? await computeMlForecast(ddbProduct, pricing).catch(() => null)
    : null;

  return toMvpLegoSet({ curated, ddbProduct, pricing, history, mlForecast });
}

export async function loadLiveCuratedCatalog(): Promise<MvpLegoSet[]> {
  let bySetNumber: Map<string, DdbLegoSet>;
  try {
    bySetNumber = await loadCatalogBySetNumber();
  } catch (err) {
    console.warn("[live-catalog] loadStoredCatalog failed, using curated fallback:", err);
    return LEGO_SETS.map((set) => ({ ...set }));
  }

  return Promise.all(
    LEGO_SETS.map((curated) => adaptCuratedSet(curated, bySetNumber.get(curated.setNumber) ?? null))
  );
}

export async function loadLiveCuratedSet(slug: string): Promise<MvpLegoSet | null> {
  const curated = LEGO_SETS.find((set) => set.id === slug);
  if (!curated) return null;

  let bySetNumber: Map<string, DdbLegoSet>;
  try {
    bySetNumber = await loadCatalogBySetNumber();
  } catch (err) {
    console.warn("[live-catalog] loadStoredCatalog failed, using curated set fallback:", err);
    return { ...curated };
  }

  return adaptCuratedSet(curated, bySetNumber.get(curated.setNumber) ?? null);
}

export async function loadLiveHistory(slug: string): Promise<LiveHistoryPoint[]> {
  const curated = LEGO_SETS.find((set) => set.id === slug);
  if (!curated) return [];

  let bySetNumber: Map<string, DdbLegoSet>;
  try {
    bySetNumber = await loadCatalogBySetNumber();
  } catch (err) {
    console.warn("[live-catalog] loadStoredCatalog failed, no live history available:", err);
    return [];
  }

  const ddbProduct = bySetNumber.get(curated.setNumber);
  if (!ddbProduct) return [];
  const history = await loadHistoryWithFallback(ddbProduct);
  return history.map((point) => ({
    date: point.date,
    price: point.price,
    source: "real",
  }));
}
