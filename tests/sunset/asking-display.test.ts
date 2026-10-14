import {it,expect,vi} from 'vitest';
vi.mock('@/lib/api/ebay',()=>({searchEbayByKeywords:vi.fn(async()=>({itemSummaries:[{itemId:'fixture',title:'LEGO 10316 new sealed',itemWebUrl:'https://www.ebay.com/itm/fixture',price:{value:'100',currency:'USD'},condition:'New'}]})),wrapAffiliateUrl:(url:string)=>url}));
import {fetchEbayListings} from '@/lib/server/ebay-listings';
it('labels single observed offers with condition, sample and collection date',async()=>{const listings=await fetchEbayListings({keywords:'LEGO 10316',customId:'fixture'});expect(listings[0]).toMatchObject({kind:'asking',provider:'ebay',sampleSize:1,condition:'New'});expect(Date.parse(listings[0].observedAt)).toBeGreaterThan(0);});
