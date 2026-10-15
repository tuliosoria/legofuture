import {afterEach,it,expect,vi} from 'vitest';
import {GET} from '@/app/api/health/route';
afterEach(()=>vi.unstubAllEnvs());
it('separates liveness from unconfigured provider readiness',async()=>{vi.stubEnv('EBAY_CLIENT_ID','');expect(await (await GET()).json()).toMatchObject({status:'ok',readiness:{valuation:'unavailable',ebay:{status:'unavailable',reason:'missing-config'}}});});
it('configuration alone does not prove provider readiness',async()=>{vi.stubEnv('EBAY_CLIENT_ID','fixture');vi.stubEnv('EBAY_CLIENT_SECRET','fixture');vi.stubEnv('EBAY_VERIFIED_DAILY_LIMIT','20');expect(await (await GET()).json()).toMatchObject({readiness:{ebay:{status:'unknown',reason:'not-probed'}}});});
