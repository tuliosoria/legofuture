import type { EbayBrowseSearchInput, EbayBrowseSearchResponse, EbayBrowsePaginatedResult } from "./types";
export interface PaginateOptions { maxPages?:number }
/** Live Browse is intentionally off regardless of inherited credentials/quota. */
export async function searchEbayByKeywords(_input:EbayBrowseSearchInput):Promise<EbayBrowseSearchResponse> {void _input;throw new Error("disabled: eBay Browse publication remains off");}
export async function searchEbayByKeywordsAll(_input:EbayBrowseSearchInput,_opts:PaginateOptions={}):Promise<EbayBrowsePaginatedResult> {void _input;void _opts;throw new Error("disabled: eBay Browse publication remains off");}
