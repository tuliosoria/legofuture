'use client';
import { useState } from 'react';
import Link from 'next/link';
import { VALUATION_UNAVAILABLE } from '@/lib/domain/sunset-policy';
export interface CatalogIdentity {id:string;name:string;setNumber:string;theme:string;year:number;status:string;pieces:number}
export function SunsetCatalog({sets=[], title='LEGO set catalog'}:{sets?:CatalogIdentity[];title?:string}) {
 const [query,setQuery]=useState('');
 const filtered=sets.filter(set=>`${set.name} ${set.setNumber} ${set.theme}`.toLowerCase().includes(query.toLowerCase()));
 return <section className="mx-auto max-w-[1240px] px-4 md:px-8 py-10">
  <h1 className="type-h1">{title}</h1>
  <p role="status" className="my-5 border-2 border-jet-black bg-sunshine-yellow p-4">{VALUATION_UNAVAILABLE}</p>
  <p className="mb-6">Browse sets and check current eBay offers. Prices remain unavailable until source rights and observation provenance are verified.</p>
  <label className="block mb-2" htmlFor="catalog-search">Search name, set number or theme</label>
  <input id="catalog-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} className="border-2 border-jet-black rounded px-3 py-2 w-full mb-6" />
  <p className="mb-4">{filtered.length} sets</p>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{filtered.map(set=><article key={set.id} className="border-2 border-jet-black rounded-card bg-pure-white p-5">
   <p className="type-caption">#{set.setNumber} · {set.theme}</p><h2 className="type-h4 my-2">{set.name}</h2>
   <p>{set.year} · {set.status} · {set.pieces.toLocaleString()} pieces</p><p className="my-3">Price unavailable</p>
   <Link href={`/set-forecast/${set.id}`} className="text-bright-blue underline">View set →</Link>
  </article>)}</div>
 </section>;
}
