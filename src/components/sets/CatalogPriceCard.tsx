import Link from "next/link";
import Image from "next/image";
import { LEGO_SETS } from "@/lib/data/sets";
import type { LegoSet, Forecast, ProductPricing } from "@/lib/types/lego";

/** A catalog observation, not an automatic investment recommendation. */
export function CatalogPriceCard({product, pricing}: {product: LegoSet; forecast: Forecast; pricing?: ProductPricing | null}) {
  const curated = LEGO_SETS.find((set) => set.setNumber === product.setNumber?.replace(/-\d+$/, ""));
  const price = pricing?.newPrice;
  const observed = typeof price === "number" && price > 0;
  const observation = pricing?.observations?.newSealed;
  return (
    <article className="rounded-card border-2 border-slate-200 bg-pure-white p-4">
      {product.imageUrl && <div className="relative h-40 mb-3"><Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain" /></div>}
      <p className="type-caption text-slate-500">{product.theme} · #{product.setNumber}</p>
      <h2 className="type-body font-semibold mt-1">{product.name}</h2>
      <p className="type-caption text-slate-600 mt-2">{product.investmentUniverse ? "Classification recorded" : "Not classified"}</p>
      {observed ? <p className="type-body mt-3">New / sealed reference: <strong>${price?.toLocaleString()}</strong></p> : <p className="type-body-sm mt-3 text-slate-500">No observed price available</p>}
      {observed && <p className="type-caption text-slate-500 mt-2">
        Source: {observation?.source ?? "Not recorded"} · Observed: {observation?.observedAt?.slice(0, 10) ?? "Date not recorded"}
      </p>}
      <p className="type-caption text-slate-500 mt-2">Reference price only, not a confirmed sale. Shipping and taxes may differ.</p>
      {curated && <Link href={`/set-forecast/${curated.id}`} className="inline-block mt-4 underline type-body-sm">View curated forecast</Link>}
    </article>
  );
}
