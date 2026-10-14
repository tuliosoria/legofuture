import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {mergePricingRows} from '@/lib/domain/lego-estimate';
describe('legacy pricing quarantine',()=>{
 it.each([[],[{sk:'v1','new-price':12345}], [{sk:'bricklink',newAvg:99.5}], [{sk:'brickset',currentValueNew:80}], [{sk:'ebay-sold',avgSoldPrice:70,soldCount:12}], [{sk:'ebay-asking-v1',medianAskingPrice:100}], [{sk:'v1','new-price':0}]])('returns no valuation/provider count for unaudited rows %j',(...rows)=>{expect(mergePricingRows(rows as Record<string,unknown>[])).toEqual({pricing:null,providerCount:0});});
});
