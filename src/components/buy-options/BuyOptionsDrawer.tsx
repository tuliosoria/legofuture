"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Sheet } from "@/components/ui/Sheet";
import type { BuyOptionsContext, BuyOptionsListing } from "./types";

type DrawerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; listings: BuyOptionsListing[] };

interface BuyOptionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: BuyOptionsContext | null;
}

async function fetchListings(
  context: BuyOptionsContext,
  signal: AbortSignal,
): Promise<{ listings: BuyOptionsListing[] }> {
  const res = await fetch("/api/ebay/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keywords: context.keywords,
      productKey: context.productKey,
      surface: context.surface,
    }),
    signal,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Request failed.");
  return { listings: json.data?.listings ?? [] };
}

export function BuyOptionsDrawer({
  open,
  onOpenChange,
  context,
}: BuyOptionsDrawerProps) {
  const [state, setState] = useState<DrawerState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open || !context) {
      abortRef.current?.abort();
      abortRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "loading" });

    fetchListings(context, controller.signal)
      .then(({ listings }) => {
        if (controller.signal.aborted) return;
        if (listings.length === 0) {
          setState({ status: "empty" });
        } else {
          setState({ status: "ready", listings });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Network error.";
        setState({ status: "error", message: msg });
      });

    return () => {
      controller.abort();
    };
  }, [open, context]);

  const title = context ? `eBay listings: ${context.productName}` : "eBay listings";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="space-y-3">
        {state.status === "loading" && (
          <div className="space-y-3" aria-live="polite" aria-label="Loading listings">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-card border-2 border-jet-black bg-pure-white p-3"
              >
                <div className="h-16 w-16 shrink-0 rounded-chip bg-slate-200 animate-pulse" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-3/4 rounded bg-slate-200 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-slate-200" />
                  <div className="h-3 w-1/4 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {state.status === "error" && (
          <div
            role="alert"
            className="rounded-card border-2 border-jet-black bg-brick-red/10 p-4 text-sm text-brick-red"
          >
            <p className="font-semibold">Could not load listings.</p>
            <p className="mt-1 text-xs text-jet-black">{state.message}</p>
          </div>
        )}

        {state.status === "empty" && (
          <p className="py-6 text-center type-body-sm text-slate-700">
            No active listings right now. Try again later.
          </p>
        )}

        {state.status === "ready" && (
          <ul className="space-y-3" aria-label="eBay listings">
            {state.listings.map((listing) => (
              <li
                key={listing.itemId}
                className="flex gap-3 rounded-card border-2 border-jet-black bg-pure-white p-3 transition-all hover:bg-sunshine-yellow/30"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-chip border border-slate-200 bg-pure-white">
                  {listing.imageUrl && (
                    <Image
                      src={listing.imageUrl}
                      alt={listing.title}
                      fill
                      sizes="64px"
                      className="object-contain"
                      unoptimized
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = "0";
                      }}
                    />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div className="min-w-0">
                    <p className="line-clamp-2 type-body-sm font-semibold leading-snug text-jet-black">
                      {listing.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 type-caption text-slate-500">
                      {listing.condition && <span>{listing.condition}</span>}
                      {listing.seller && (
                        <span>
                          {listing.seller.username}
                          {listing.seller.feedbackPercentage
                            ? ` · ${listing.seller.feedbackPercentage}%`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    {listing.price && (
                      <span className="type-h4 tabular-nums text-jet-black">
                        {listing.price.currency === "USD"
                          ? "$"
                          : listing.price.currency + " "}
                        {parseFloat(listing.price.value).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                    <a
                      href={listing.affiliateUrl}
                      target="_blank"
                      rel="sponsored nofollow noopener"
                      title="Affiliate link, we may earn a commission"
                      className="inline-flex items-center justify-center rounded-chip border-2 border-jet-black bg-brick-red px-3 py-1.5 text-xs font-semibold text-pure-white hover:-translate-x-px hover:-translate-y-px hover:shadow-click transition-all"
                    >
                      View ↗
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {state.status === "ready" && (
          <p className="pt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Links are eBay Partner Network affiliate. We may earn a commission.
          </p>
        )}
      </div>
    </Sheet>
  );
}
