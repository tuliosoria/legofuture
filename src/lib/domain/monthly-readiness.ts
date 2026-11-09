/** Readiness is not a sync receipt. Never use the clock as an observation date.
 * The provider gate is intentionally code-reviewed, not an environment toggle.
 */
export function getMonthlyReadiness(now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid clock');
  return {
    requestedMonth: now.toISOString().slice(0, 7),
    status: 'blocked' as const,
    scheduler: 'not-enabled' as const,
    dataMonth: null,
    lastSuccessfulDataUpdate: null,
    prices: 'unavailable' as const,
    ranking: 'unavailable' as const,
    blockers: ['source-access-and-publication-rights-unverified', 'monthly-pipeline-not-activated'],
  };
}
