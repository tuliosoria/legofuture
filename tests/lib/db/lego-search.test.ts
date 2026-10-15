import {vi,describe,it,expect} from 'vitest';
vi.mock('server-only',()=>({}));
import {loadStoredCatalog,getProductById,getProductBySlug} from '@/lib/db/lego-search';
import {SUNSET_CATALOG} from '@/lib/data/sunset-catalog';
describe('publication identity boundary',()=>{
 it('preserves the approved identity allowlist without remote metadata or prices',async()=>{const sets=await loadStoredCatalog({includeOrphans:true});expect(sets.map(set=>set.id)).toEqual(SUNSET_CATALOG.map(set=>set.id));for(const set of sets){expect(set.imageUrl).toBe('');expect(set.forecastEligible).toBe(false);expect(set.soldComps90d).toBeUndefined();expect(set.pricingProviderCount).toBeUndefined();}});
 it('keeps id, set-number and slug lookup working offline',async()=>{const first=SUNSET_CATALOG[0];expect((await getProductById(first.id))?.name).toBe(first.name);expect((await getProductById(first.setNumber))?.id).toBe(first.id);expect((await getProductBySlug(first.id))?.setNumber).toBe(first.setNumber);expect(await getProductById('unknown')).toBeNull();});
});
