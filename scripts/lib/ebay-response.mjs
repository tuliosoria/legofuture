/** Standalone jobs stop on quota/auth; a later scheduler must honor retryAt. */
export function assertOAuthResponse(response, now = Date.now()) {
 if (response.status === 429) {
  const value=response.headers.get('Retry-After');
  const delay=value && /^\d+$/.test(value) ? Number(value)*1000 : Date.parse(value??'')-now;
  const retryAt=now+(Number.isFinite(delay)&&delay>0?delay:3600000);
  throw new Error(`quota: OAuth rate limited; stop job until ${new Date(retryAt).toISOString()}`);
 }
 if (!response.ok) throw new Error('auth: OAuth unavailable; stop job');
}
export function isTerminalEbayError(error) { return error instanceof Error && /^(quota|auth):/.test(error.message); }
