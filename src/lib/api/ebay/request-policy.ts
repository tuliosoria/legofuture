import { getEbayAccessToken } from './token';
import { fetchWithDeadline, EbayQuotaError, quotaError } from './deadline';
export interface RequestOptions { fetchImpl: typeof fetch; now: () => number; signal?: AbortSignal; appBudgetKey: string; dailyLimit: number; maxPages: number; page?: number }
const budgets=new Map<string,{day:number;used:number;cooldown:number}>();
const pending=new Map<string,Promise<Response>>();
export function resetRequestPolicy() { budgets.clear();pending.clear(); }
export async function requestEbay(url:string, options:RequestOptions):Promise<Response> {
 const {dailyLimit,maxPages,appBudgetKey,now,fetchImpl}=options;
 if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET || !Number.isSafeInteger(dailyLimit) || dailyLimit<=0 || !Number.isSafeInteger(maxPages) || maxPages<=0 || !appBudgetKey) throw new Error('missing-config');
 const target=new URL(url);
 if(target.origin!=='https://api.ebay.com' || target.username || target.password || !target.pathname.startsWith('/buy/browse/')) throw new Error('invalid-data');
 if ((options.page ?? 1)>maxPages) throw new Error('quota');
 const time=now(),day=Math.floor(time/86400000);
 let budget=budgets.get(appBudgetKey);
 if(!budget || budget.day!==day) { budget={day,used:0,cooldown:budget?.cooldown??0};budgets.set(appBudgetKey,budget); }
 if(budget.cooldown>time) throw new Error('quota');
 const key=`${appBudgetKey}:${url}`;
 const existing=pending.get(key); if(existing) return (await existing).clone();
 const state=budget;
 const work=(async()=>{
  for(let attempt=0;attempt<2;attempt++) {
   if(state.used>=dailyLimit || state.cooldown>now()) throw new Error('quota');
   state.used++;
   let token:string;
   try { token=await getEbayAccessToken(attempt===1,fetchImpl,now); }
   catch(err) { if(err instanceof EbayQuotaError) state.cooldown=err.retryAt;throw err; }
   const res=await fetchWithDeadline(fetchImpl,url,{signal:options.signal,headers:{Authorization:`Bearer ${token}`,'X-EBAY-C-MARKETPLACE-ID':'EBAY_US',Accept:'application/json'}});
   if(res.status===429) { const error=quotaError(res,now());state.cooldown=error.retryAt;throw error; }
   if(res.status===401 && attempt===0) continue;
   if(res.status===401 || res.status===403) throw new Error('auth');
   if(!res.ok) throw new Error('network');
   return res;
  }
  throw new Error('auth');
 })();
 pending.set(key,work);
 try { return (await work).clone(); } finally { pending.delete(key); }
}
