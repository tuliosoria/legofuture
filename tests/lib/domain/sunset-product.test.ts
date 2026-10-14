import { describe,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { mergePricingRows, fetchLivePricing } from '@/lib/domain/lego-estimate';
import { forecastForSet } from '@/lib/domain/lego-forecast';
import { LEGO_SETS } from '@/lib/data/sets';
import { toMvpLegoSet } from '@/lib/data/live-catalog';
import { getProductById } from '@/lib/db/lego-search';
void getProductById;
describe('sunset product',()=>{
 it('quarantines unlicensed PC and ambiguous sold cache',()=>expect(mergePricingRows([{sk:'v1','new-price':10000},{sk:'ebay-sold',avgSoldPrice:120,soldCount:50}])).toEqual({pricing:null,providerCount:0}));
 it('never calls PC even with configuration',async()=>{ const spy=vi.spyOn(globalThis,'fetch'); expect(await fetchLivePricing({} as never)).toBeNull(); expect(spy).not.toHaveBeenCalled(); spy.mockRestore(); });
 it('suspends forecasts despite legacy price and ample history',()=>{const result=forecastForSet({id:'1',setNumber:'10316',theme:'Icons',originalMsrp:100} as never,{newPrice:100,cibPrice:null,loosePrice:null,salesVolume:50,lastFetched:'2026-10-14'},Array.from({length:12},(_,i)=>({date:`2025-${i+1}-01`,price:100})));expect(result.forecastEligible).toBe(false);expect(result.currentPrice).toBeNull();expect(result.recommendation).toBeNull();});
 it('catalog identity survives while curated recommendations are withheld',()=>{const set=toMvpLegoSet({curated:LEGO_SETS[0],ddbProduct:null,pricing:null,history:[],mlForecast:null});expect(set.id).toBe(LEGO_SETS[0].id);expect(set.marketStatus).toBe('unavailable');});
});
