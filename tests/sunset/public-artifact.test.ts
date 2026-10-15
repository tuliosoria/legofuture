import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
vi.mock('server-only',()=>({}));
import {searchEbayByKeywords,searchEbayByKeywordsAll} from '@/lib/api/ebay/browse';
it('Browse stays disabled even with full environment configuration',async()=>{vi.stubEnv('EBAY_CLIENT_ID','fixture');vi.stubEnv('EBAY_CLIENT_SECRET','fixture');vi.stubEnv('EBAY_VERIFIED_DAILY_LIMIT','100');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);try{await expect(searchEbayByKeywords({keywords:'fixture'})).rejects.toThrow('disabled');await expect(searchEbayByKeywordsAll({keywords:'fixture'})).rejects.toThrow('disabled');expect(fetch).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();vi.unstubAllEnvs();}});
it('public catalog does not import the retained financial dataset or media overrides',()=>{expect(readFileSync('src/lib/data/sunset-catalog.ts','utf8')).not.toMatch(/from ['"]\.\/sets['"]/);expect(readFileSync('src/lib/db/lego-search.ts','utf8')).not.toMatch(/lego-catalog-overrides|pricecharting|from "@aws-sdk/);});
it('public forecast facade never imports retained models at runtime',()=>expect(readFileSync('src/lib/domain/lego-forecast.ts','utf8')).not.toMatch(/import \{ loadForecastModel|import bundled|from "@\/lib\/db\/lego-forecast-models"/));
it('published methodology does not claim completed-sale forecasts are currently running',()=>expect(readFileSync('src/app/methodology/page.tsx','utf8')).not.toContain('publishes a 5-year price forecast for every set'));
