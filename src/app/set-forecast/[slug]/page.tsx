import Link from "next/link";
import { notFound } from "next/navigation";
import { SUNSET_CATALOG } from "@/lib/data/sunset-catalog";
import { SeeOnEbayButton } from "@/components/buy-options/SeeOnEbayButton";
import { VALUATION_UNAVAILABLE } from "@/lib/domain/sunset-policy";
interface Params { params: Promise<{slug:string}> }
export function generateStaticParams() { return SUNSET_CATALOG.map(set=>({slug:set.id})); }
export async function generateMetadata({params}:Params) { const {slug}=await params;const set=SUNSET_CATALOG.find(set=>set.id===slug);return {title:set?`${set.name} (#${set.setNumber})`:'Set not found',description:'LEGO set identity and current offers. Forecast unavailable.'}; }
export default async function Page({params}:Params) {
 const {slug}=await params;const set=SUNSET_CATALOG.find(set=>set.id===slug);if(!set) notFound();
 return <section className="mx-auto max-w-[1100px] px-4 md:px-8 py-10"><Link href="/set-forecast" className="underline">← All sets</Link>
 <h1 className="type-h1 mt-6">{set.name}</h1><p className="my-3">#{set.setNumber} · {set.theme} · {set.year} · {set.pieces.toLocaleString()} pieces · {set.status}</p>
 <p role="status" className="border-2 border-jet-black bg-sunshine-yellow p-4 my-6">{VALUATION_UNAVAILABLE}</p>
 <p className="mb-6">Price unavailable. eBay asking prices reflect active offers, not completed sales or market value. Condition, currency and collection time are shown with each offer.</p>
 <SeeOnEbayButton context={{productKey:set.id,productName:set.name,keywords:`LEGO ${set.setNumber} new sealed`,surface:'lego-detail'}} />
 </section>;
}
