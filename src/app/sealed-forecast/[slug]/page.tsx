import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getProductBySlug, loadStoredCatalog } from "@/lib/db/sealed-search";
import { getPricingFromBundle } from "@/lib/domain/sealed-estimate";
import { computeForecast } from "@/lib/domain/sealed-forecast";
import { ModelDetails } from "@/components/sealed/ModelDetails";
import { DetailClient } from "./DetailClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const catalog = await loadStoredCatalog();
  return catalog.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Not Found | LegoFuture" };
  return {
    title: `${product.name} Forecast | LegoFuture`,
    description: `5-year sealed price forecast for LEGO ${product.name} (${product.setNumber}). Signal, ROI, and scenario analysis.`,
  };
}

export default async function SlugPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const pricing = getPricingFromBundle(product.id);
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

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 text-xs text-[hsl(var(--muted-foreground))]">
        <Link href="/sealed-forecast" className="hover:text-[hsl(var(--foreground))]">
          ← Back to Catalog
        </Link>
      </nav>

      <h1 className="mb-1 text-3xl font-extrabold">{product.name}</h1>
      <p className="mb-8 text-sm text-[hsl(var(--muted-foreground))]">
        {product.theme} · Set #{product.setNumber} · {product.releaseYear}
      </p>

      <DetailClient product={product} forecast={forecast} />

      {/* Model Details (server) */}
      <div className="mt-8">
        <ModelDetails product={product} forecast={forecast} />
      </div>
    </main>
  );
}
