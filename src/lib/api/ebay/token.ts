import type { CachedEbayToken } from './types';
import { fetchWithDeadline, quotaError } from './deadline';
let cache: CachedEbayToken | null = null;
let pending: Promise<string> | null = null;
export function __resetTokenCacheForTests(): void { cache=null; pending=null; }
export async function getEbayAccessToken(force=false, fetchImpl: typeof fetch=fetch, now: () => number=Date.now): Promise<string> {
 const id=process.env.EBAY_CLIENT_ID, secret=process.env.EBAY_CLIENT_SECRET;
 if (!id || !secret) throw new Error('missing-config');
 if (!force && cache && cache.expiresAt-60_000>now()) return cache.accessToken;
 if (pending) return pending;
 pending=(async()=>{
  const res=await fetchWithDeadline(fetchImpl,'https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'});
  if (res.status===429) throw quotaError(res,now());
  if (!res.ok) throw new Error('auth');
  let data; try { data=await res.json(); } catch { throw new Error('invalid-data'); }
  if (typeof data.access_token!=='string' || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in<=0) throw new Error('invalid-data');
  cache={accessToken:data.access_token,expiresAt:now()+data.expires_in*1000};
  return cache.accessToken;
 })();
 try { return await pending; } finally { pending=null; }
}
