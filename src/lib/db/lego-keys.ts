export const CATALOG_PK_PREFIX = "CATALOG#PRODUCT#";
export const PRICING_PK_PREFIX = "PRICING#PRODUCT#";
export const HISTORY_PK_PREFIX = "HISTORY#PRODUCT#";
export const COMMUNITY_PK_PREFIX = "COMMUNITY#PRODUCT#";
export const MODEL_PK_PREFIX = "MODEL#";
export const SYNC_META_PK_PREFIX = "META#SYNC#";

export type HistorySource =
  | "bricklink-new"
  | "bricklink-used"
  | "pricecharting-loose"
  | "pricecharting-cib"
  | "pricecharting-new"
  | "pricecharting-snapshot"
  | "ebay";

export type ForecastHorizon = "1yr" | "3yr" | "5yr";

export const catalogPk = (setNum: string) => `${CATALOG_PK_PREFIX}${setNum}`;
export const pricingPk = (setNum: string) => `${PRICING_PK_PREFIX}${setNum}`;
export const historyPk = (setNum: string) => `${HISTORY_PK_PREFIX}${setNum}`;
export const communityPk = (setNum: string) => `${COMMUNITY_PK_PREFIX}${setNum}`;

export function historySk(source: HistorySource, date: Date): string {
  return `${source}#${date.toISOString().slice(0, 7)}`;
}

export function modelChunkSk(horizon: ForecastHorizon, chunkIndex: number): string {
  return `FORECAST#${horizon}#chunk#${String(chunkIndex).padStart(4, "0")}`;
}

export function syncMetaPk(source: string, isoTs: string): string {
  return `${SYNC_META_PK_PREFIX}${source}#${isoTs}`;
}

// --- Curated watchlist keys ---
export const CURATED_PK_PREFIX = "CURATED#SET#";
export const VOTE_PK_PREFIX = "VOTE#IP#";
export const CURATED_SCORES_SK = "scores";
export const CURATED_VOTE_COUNT_SK = "vote-count";

export const curatedScoresPk = (setNumber: string) =>
  `${CURATED_PK_PREFIX}${setNumber}`;
export const voteIpPk = (hashedIp: string) =>
  `${VOTE_PK_PREFIX}${hashedIp}`;
export const voteIpSk = (setNumber: string) => `SET#${setNumber}`;

/** SK used when writing eBay sold-comps directly onto a catalog row */
export const EBAY_COMPS_SK = "ebay-comps";
