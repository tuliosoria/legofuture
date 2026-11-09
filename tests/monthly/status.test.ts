import { describe, expect, it } from 'vitest';
import { getMonthlyReadiness } from '@/lib/domain/monthly-readiness';

describe('monthly readiness', () => {
  it('reports November as the requested month, never a successful data update', () => {
    const state = getMonthlyReadiness(new Date('2026-11-09T17:00:00Z'));
    expect(state.requestedMonth).toBe('2026-11');
    expect(state.status).toBe('blocked');
    expect(state.scheduler).toBe('not-enabled');
    expect(state.lastSuccessfulDataUpdate).toBeNull();
    expect(state.dataMonth).toBeNull();
    expect(state.prices).toBe('unavailable');
    expect(state.ranking).toBe('unavailable');
    expect(state.blockers).toContain('source-access-and-publication-rights-unverified');
  });
  it('rolls the requested month in UTC without renewing observations', () => {
    const before = getMonthlyReadiness(new Date('2026-11-30T23:59:59Z'));
    const after = getMonthlyReadiness(new Date('2026-12-01T00:00:00Z'));
    expect(before.requestedMonth).toBe('2026-11');
    expect(after.requestedMonth).toBe('2026-12');
    expect(after.dataMonth).toBeNull();
    expect(after.lastSuccessfulDataUpdate).toBeNull();
  });
  it('rejects an invalid clock', () => {
    expect(() => getMonthlyReadiness(new Date('invalid'))).toThrow('Invalid clock');
  });
});

it('preflight reports blocked with a non-success exit code and no false receipt', async () => {
  const { spawnSync } = await import('node:child_process');
  const run = spawnSync(process.execPath, ['scripts/monthly-readiness.mjs'], { encoding: 'utf8' });
  expect(run.status).toBe(2);
  expect(JSON.parse(run.stdout)).toMatchObject({ status: 'blocked', dataMonth: null, lastSuccessfulDataUpdate: null });
});
