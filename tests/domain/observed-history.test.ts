import {describe,it,expect} from 'vitest';
import {mergeObservedHistory} from '../../src/lib/domain/observed-history';
describe('real eBay history',()=>{
 it('keeps one actual latest observation per month, not daily training points',()=>{
  expect(mergeObservedHistory([{date:'2026-10-01',price:50}], [
   {sk:'new-sealed#2026-11-01',price:60,capturedAt:'2026-11-01T07:00:00Z',source:'ebay'},
   {sk:'new-sealed#2026-11-18',price:65,capturedAt:'2026-11-18T07:00:00Z',source:'ebay'},
  ])).toEqual([{date:'2026-10-01',price:50},{date:'2026-11-18',price:65}]);
 });
 it('ignores invalid/nonpositive/undated rows and never fabricates missing months',()=>{
  expect(mergeObservedHistory([], [{price:0,source:'ebay'}, {price:50,capturedAt:'bad',source:'ebay'}])).toEqual([]);
 });
});

it('uses observation dates rather than the check/sort key and rejects numeric junk',()=>{
 expect(mergeObservedHistory([], [
  {sk:'new-sealed#2026-12-01',source:'ebay',capturedAt:'2026-11-18T07:00:00Z',price:77},
  {source:'other',capturedAt:'2026-11-19T07:00:00Z',price:88},
  {source:'ebay',capturedAt:'2026-11-20T07:00:00Z',price:null},
 ])).toEqual([{date:'2026-11-18',price:77}]);
});
