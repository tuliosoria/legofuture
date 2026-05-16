import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/db/sealed-search";
import { getPricing } from "@/lib/domain/sealed-estimate";
import { computeForecast } from "@/lib/domain/sealed-forecast";

export const dynamic = "force-dynamic";
export const revalidate = 300;
import { ModelDetails } from "@/components/sealed/ModelDetails";
import { DetailClient } from "./DetailClient";
import { ChipBadge } from "@/components/ui/ChipBadge";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not Found | LegoFuture" };
  return {
    title: `${product.name} Forecast | LegoFuture`,
    description: `5-year sealed price forecast for LEGO ${product.name} (${product.setNumber}). Signal, ROI, and scenario analysis.`,
  };
}

const signalToAccentBg: Record<string, string> = {
  Buy: "bg-bright-blue text-pure-white",
  Hold: "bg-sunshine-yellow text-jet-black",
  Sell: "bg-jet-black text-pure-white",
};

const signalToChipColor: Record<string, "blue" | "yellow" | "black"> = {
  Buy: "blue",
  Hold: "yellow",
  Sell: "black",
};

export default async function SlugPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const pricing = await getPricing(product);
  const forecast = computeForecast(
    product,
    pricing ?? {
      newPrice: product.originalMsrp ?? 0,
      cibPrice: null,
      loosePrice: null,
      salesVolume: null,
      lastFetched: "",
    }
  );

  const heroBg = signalToAccentBg[forecast.signal] ?? "bg-slate-100 text-jet-black";

  return (
    <main>
      {/* Hero band */}
      <div className={`w-full border-b-2 border-jet-black ${heroBg}`}>
        <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-8">
          <nav className="mb-4 type-body-sm opacity-70">
            <Link href="/sealed-forecast" className="hover:underline">
              ← Back to Catalog
            </Link>
          </nav>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="type-eyebrow opacity-70 mb-2">
                {product.theme} · Set #{product.setNumber} · {product.releaseYear}
              </p>
              <h1 className="type-display-2 mb-3">{product.name}</h1>
              <div className="flex flex-wrap gap-3 items-center">
                <ChipBadge color={signalToChipColor[forecast.signal] ?? "black"}>
                  {forecast.signal}
                </ChipBadge>
                {product.retired && (
                  <ChipBadge color="black">Retired</ChipBadge>
                )}
              </div>
            </div>
            <div className="flex gap-6 flex-wrap">
              <div>
                <p className="type-eyebrow opacity-70 mb-1">MSRP</p>
                <p className="type-mono-num text-xl font-bold">
                  ${product.originalMsrp.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="type-eyebrow opacity-70 mb-1">Current Price</p>
                <p className="type-mono-num text-xl font-bold">
                  ${forecast.currentPrice.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-10">
        <DetailClient product={product} forecast={forecast} />

        <div className="mt-8">
          <ModelDetails product={product} forecast={forecast} />
        </div>
      </div>
    </main>
  );
}
