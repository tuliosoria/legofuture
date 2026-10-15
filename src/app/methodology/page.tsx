import Link from "next/link";
export const metadata={title:"Catalog methodology · BricksFuture",description:"Current catalog scope and suspended automated valuations."};
export default function MethodologyPage(){return <section className="mx-auto max-w-[1100px] px-4 md:px-8 py-10"><h1 className="type-h1">Catalog methodology</h1><div className="type-body text-slate-700 space-y-4 mt-6">
<p>The current release displays curated LEGO set identities: set number, name, theme, year, piece count and retirement status. Catalog entries can be searched and browsed without a price provider.</p>
<p role="status">Automated prices, forecasts, BUY/HOLD/SELL signals, sold liquidity and investment rankings are suspended. Retained datasets and trained models are excluded from the deployment artifact pending publication-rights review.</p>
<p>eBay Browse collection and live offers remain disabled. Browse provides active asking offers, not completed sales or market values. Future listing display requires verified access, quota, rights and a maximum six-hour display age with observation provenance.</p>
<p>Missing prices remain unavailable. MSRP and synthetic history do not substitute for observed sales. No current performance or return claim is made for the suspended models.</p>
<Link href="/set-forecast" className="text-bright-blue underline">Browse the catalog →</Link>
</div></section>;}
