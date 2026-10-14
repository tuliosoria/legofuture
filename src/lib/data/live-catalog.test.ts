import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {loadLiveCuratedCatalog,loadLiveCuratedSet,loadLiveHistory,toMvpLegoSet} from './live-catalog';
import {LEGO_SETS} from './sets';
describe('sunset catalog identity boundary',()=>{
 it('offline catalog preserves every identity without serializing curated prices/signals',async()=>{const sets=await loadLiveCuratedCatalog();expect(sets.map(set=>set.id)).toEqual(LEGO_SETS.map(set=>set.id));for(const set of sets){expect(set.marketStatus).toBe('unavailable');expect(set).not.toHaveProperty('currentPrice');expect(set).not.toHaveProperty('proj5y');expect(set).not.toHaveProperty('signal');expect(set).not.toHaveProperty('score');}});
 it('detail lookup retains identity and handles unknown slug',async()=>{expect((await loadLiveCuratedSet(LEGO_SETS[0].id))?.setNumber).toBe(LEGO_SETS[0].setNumber);expect(await loadLiveCuratedSet('missing')).toBeNull();});
 it('does not substitute historical/synthetic data on failure',async()=>expect(await loadLiveHistory(LEGO_SETS[0].id)).toEqual([]));
 it('adapter drops valuation even when legacy data are supplied',()=>{const result=toMvpLegoSet({curated:LEGO_SETS[0],ddbProduct:null,pricing:{newPrice:100,cibPrice:null,loosePrice:null,salesVolume:500,lastFetched:'2026-10-14'},history:[{date:'2026-10-14',price:100}],mlForecast:null});expect(result).not.toHaveProperty('currentPrice');expect(result).not.toHaveProperty('liquidity');});
});
