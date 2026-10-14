export class EbayQuotaError extends Error {
  constructor(public readonly retryAt: number) { super('quota'); }
}
export function quotaError(response: Response, now: number): EbayQuotaError {
  const value = response.headers.get('Retry-After');
  const delay = value && /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value ?? '') - now;
  return new EbayQuotaError(now + (Number.isFinite(delay) && delay > 0 ? delay : 3_600_000));
}
/** Request deadline includes headers AND body. Buffer before returning so a
 * stalled body cannot escape the deadline through a later response.json(). */
export async function fetchWithDeadline(fetchImpl: typeof fetch, url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new Error('timeout'));
    signal.addEventListener('abort', onAbort, {once: true});
    timer = setTimeout(() => controller.abort(), 10_000);
    if (signal.aborted) reject(new Error('timeout'));
  });
  const response = (async () => {
    const res = await fetchImpl(url, {...init, signal});
    const body = await res.arrayBuffer();
    return new Response([204,205,304].includes(res.status) ? null : body, {status:res.status,statusText:res.statusText,headers:res.headers});
  })();
  try { return await Promise.race([response, expired]); }
  catch { throw new Error(signal.aborted ? 'timeout' : 'network'); }
  finally { clearTimeout(timer); if (onAbort) signal.removeEventListener('abort', onAbort); }
}
