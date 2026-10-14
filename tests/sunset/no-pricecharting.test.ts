import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
vi.mock('server-only',()=>({}));
import {getPricing,fetchLivePricing} from '@/lib/domain/lego-estimate';
import {computeForecast,computeMlForecast} from '@/lib/domain/lego-forecast';
import {GET as topBuys} from '@/app/api/sets/top-buys/route';
it('PC configured cannot revive outbound requests or forecasts',async()=>{vi.stubEnv('PRICECHARTING_API_TOKEN','offline-fixture');const fetch=vi.fn(async()=>{throw new Error('Forbidden outbound');});vi.stubGlobal('fetch',fetch);try{expect(await getPricing({} as never)).toBeNull();expect(await fetchLivePricing({} as never)).toBeNull();expect(computeForecast({} as never,null)).toBeNull();expect(await computeMlForecast({} as never,null)).toBeNull();expect(fetch).not.toHaveBeenCalled();expect(await (await topBuys()).json()).toMatchObject({items:[],status:'unavailable',updatedAt:null});}finally{vi.unstubAllEnvs();vi.unstubAllGlobals();}});
it.each(['sync-pricecharting-to-dynamo.mjs','sync-pricecharting-csv.mjs','scrape-pricecharting-history.mjs','backfill-current-month-history.mjs','synthesise-sparse-history.mjs','sync-images.mjs','build-baseline-pricing.mjs'])('guards %s before credential or database work',name=>{const script=readFileSync(`scripts/${name}`,'utf8');expect(script.indexOf('import "./lib/pricecharting-sunset.mjs";')).toBeGreaterThan(0);expect(script.indexOf('import "./lib/pricecharting-sunset.mjs";')).toBeLessThan(script.indexOf('from "@aws-sdk'));});
