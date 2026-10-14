import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act,cleanup,render,screen} from '@testing-library/react';
vi.mock('@/components/ui/Sheet',()=>({Sheet:({children}:{children:React.ReactNode})=><div>{children}</div>}));
import {BuyOptionsDrawer} from '@/components/buy-options/BuyOptionsDrawer';
const now = Date.parse('2026-10-14T12:00:00Z');
const sixHours=6*60*60*1000;
const context={productKey:'fixture',productName:'Fixture set',keywords:'LEGO 10316',surface:'lego-detail' as const};
function offer(age:number){return {itemId:'fixture',kind:'asking',provider:'ebay',observedAt:new Date(now-age).toISOString(),sampleSize:1,title:'fixture-offer',price:{value:'100',currency:'USD'},condition:'New',affiliateUrl:'https://www.ebay.com/itm/fixture'};}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
async function show(age:number){vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>({success:true,data:{listings:[offer(age)]}})})));await act(async()=>{render(<BuyOptionsDrawer open onOpenChange={()=>{}} context={context}/>);});}
it('withholds a listing already older than six hours',async()=>{await show(sixHours+1);expect(screen.queryByText('fixture-offer')).toBeNull();expect(screen.getByText(/Offers expired/)).toBeTruthy();});
it('displays the six-hour boundary but expires it one millisecond later without refetching',async()=>{await show(sixHours);expect(screen.getByText('fixture-offer')).toBeTruthy();await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(screen.queryByText('fixture-offer')).toBeNull();expect(fetch).toHaveBeenCalledTimes(1);});
