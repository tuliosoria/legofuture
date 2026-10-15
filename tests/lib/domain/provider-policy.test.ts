import { describe, expect, it } from 'vitest';
import { evaluateObservation, isForecastAnchor, type PriceObservation } from '@/lib/domain/price-observation';
const now = new Date('2026-10-14T12:00:00Z');
const observation: PriceObservation = { provider: 'ebay', kind: 'asking', productId: '10316', amount: 100, currency: 'USD', condition: 'new-sealed', observedAt: '2026-10-14T11:00:00Z', fetchedAt: now.toISOString(), sampleSize: 3, matchEvidence: { exact: true }, publicationAllowed: true };
const policy = { maxAgeMs: 86400000, expectedProductId: '10316', expectedCurrency: 'USD', expectedCondition: 'new-sealed', publicationAllowed: true };
describe('observation policy', () => {
 it('keeps asking separate from sold', () => { const result=evaluateObservation(observation,policy,now); expect(result.status).toBe('available'); expect(isForecastAnchor(result)).toBe(false); expect(isForecastAnchor(evaluateObservation({...observation,kind:'sold',periodStart:'2026-10-01',periodEnd:'2026-10-14'},policy,now))).toBe(true); });
 it.each([{amount:NaN},{amount:0},{observedAt:''},{observedAt:'2026-10-15'},{publicationAllowed:false},{productId:'12345'},{condition:'used'},{currency:'EUR'},{sampleSize:0},{matchEvidence:{exact:false}}])('rejects invalid provenance %j', patch=>expect(evaluateObservation({...observation,...patch},policy,now).status).toBe('unavailable'));
 it('does not renew stale observations from fetchedAt',()=>expect(evaluateObservation({...observation,observedAt:'2026-10-12T00:00:00Z'},policy,now).status).toBe('stale'));
});
describe('eBay listing display age', () => {
 const sixHours = 6 * 60 * 60 * 1000;
 const atAge = (age:number) => ({...observation, observedAt:new Date(now.getTime()-age).toISOString()});
 it('clamps a caller 24-hour asking policy to six hours without converting to sold',()=>{
  const boundary=evaluateObservation(atAge(sixHours),policy,now);
  expect(boundary.status).toBe('available');
  expect(isForecastAnchor(boundary)).toBe(false);
  expect(evaluateObservation(atAge(sixHours+1),policy,now).status).toBe('stale');
 });
 it('preserves a stricter caller display age',()=>expect(evaluateObservation(atAge(60*60*1000+1),{...policy,maxAgeMs:60*60*1000},now).status).toBe('stale'));
 it('does not rejuvenate a seven-hour observation from a new cache fetch',()=>expect(evaluateObservation({...atAge(7*60*60*1000),fetchedAt:now.toISOString()},policy,now).status).toBe('stale'));
 it('does not apply listing display age to unrelated provider/reference policy',()=>expect(evaluateObservation({...atAge(7*60*60*1000),provider:'manual',kind:'reference'},policy,now).status).toBe('available'));
});
