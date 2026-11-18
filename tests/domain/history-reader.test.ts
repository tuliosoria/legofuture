import {it,expect,vi} from 'vitest';
const send = vi.hoisted(()=>vi.fn());
vi.mock('server-only',()=>({}));
vi.mock('@/lib/db/dynamo',()=>({getDynamo:()=>({send}),getTableName:()=> 'test'}));
vi.mock('@/lib/db/cache',()=>({cacheGet:vi.fn().mockResolvedValue(null),cachePut:vi.fn()}));
import {loadHistory} from '@/lib/db/lego-history';
import type {LegoSet} from '@/lib/types/lego';
it('preserves legacy history if the supplemental source query fails',async()=>{
 send.mockResolvedValueOnce({Items:[{sk:'new-sealed#2026-10-01',price:55}]}).mockRejectedValueOnce(new Error('denied supplemental'));
 expect(await loadHistory({id:'legacy',setNumber:'75192'} as LegoSet)).toEqual([{date:'2026-10-01',price:55}]);
});
