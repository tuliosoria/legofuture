import "server-only";
import type { LegoSet } from "@/lib/types/lego";
import { SUNSET_CATALOG } from "@/lib/data/sunset-catalog";
import { coerceTheme } from "@/lib/data/lego-themes";
/** Release identity allowlist only. Retained remote metadata/media is not a publication license. */
export async function loadStoredCatalog(_opts?:{includeOrphans?:boolean;orphanCap?:number}):Promise<LegoSet[]> {
 void _opts;
 return SUNSET_CATALOG.map(set=>({id:set.id,setNumber:set.setNumber,name:set.name,theme:coerceTheme(set.theme),releaseYear:set.year,retired:set.status==='Retired',pieceCount:set.pieces,minifigCount:0,originalMsrp:0,imageUrl:'',slug:set.id,forecastEligible:false}));
}
export async function getProductById(id:string):Promise<LegoSet|null> {return (await loadStoredCatalog()).find(set=>set.id===id||set.setNumber===id)??null;}
export async function getProductBySlug(slug:string):Promise<LegoSet|null> {return (await loadStoredCatalog()).find(set=>set.slug===slug)??null;}
export { isNonRetailSetId } from "./lego-retail-identity";
