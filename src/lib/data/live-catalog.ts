import "server-only";
import { SUNSET_CATALOG } from "./sunset-catalog";
import type { LegoSet } from "@/lib/domain/lego-set";
import type { LegoSet as StoredSet, ProductPricing, HistoryPoint, Forecast } from "@/lib/types/lego";
export interface AdaptInput { curated:LegoSet; ddbProduct:StoredSet|null; pricing:ProductPricing|null; history:HistoryPoint[]; mlForecast:Forecast|null; communityScore?:number|null }
/** Return identity only: even offline fallback must not serialize embedded valuations. */
export function toMvpLegoSet({curated}:AdaptInput) {
 const {id,name,setNumber,theme,year,status,pieces}=curated;
 return {id,name,setNumber,theme,year,status,pieces,marketStatus:'unavailable' as const};
}
export async function loadLiveCuratedCatalog() { return SUNSET_CATALOG.map(set=>({...set,marketStatus:'unavailable' as const})); }
export async function loadLiveCuratedSet(slug:string) { return (await loadLiveCuratedCatalog()).find(set=>set.id===slug) ?? null; }
export async function loadLiveHistory(_slug:string) { void _slug; return []; }
/** Archived chart component compatibility; no history is published in sunset mode. */
export interface LiveHistoryPoint { date:string; price:number; source:'real'|'synthetic_backfill' }
