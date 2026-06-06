"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BrickButton } from "@/components/ui/BrickButton";

const NAV_LINKS = [
  { href: "/buying-list/retired", label: "Retired Buying List" },
  { href: "/buying-list/non-retired", label: "Non-Retired Buying List" },
  { href: "/set-forecast", label: "Set Forecast" },
  { href: "/methodology", label: "Methodology" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-sunshine-yellow border-b-2 border-jet-black">
      <div className="mx-auto max-w-[1240px] px-4 md:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Brand wordmark */}
          <Link
            href="/"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bright-blue rounded-sm"
          >
            <span
              className="type-h2 tracking-tight"
              style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
            >
              <span className="text-brick-red">Lego</span>
              <span className="text-jet-black">Future</span>
            </span>
            <span
              className="inline-flex items-center rounded-sm border-2 border-jet-black bg-pure-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-jet-black leading-none"
              aria-label="Beta version"
            >
              Beta
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "type-body-sm transition-colors",
                  pathname === link.href
                    ? "text-brick-red font-medium"
                    : "text-slate-700 hover:text-jet-black"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/contact">
              <BrickButton variant="secondary" size="sm">
                Share feedback
              </BrickButton>
            </Link>
            <Link href="/set-forecast">
              <BrickButton variant="primary" size="sm">
                See forecasts
              </BrickButton>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="md:hidden p-2 text-jet-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue rounded"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="md:hidden pb-4 pt-3 border-t-2 border-jet-black">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block py-2 type-body-sm transition-colors",
                  pathname === link.href
                    ? "text-brick-red font-medium"
                    : "text-slate-700"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 space-y-2">
              <Link href="/contact" onClick={() => setMobileOpen(false)}>
                <BrickButton variant="secondary" size="sm" className="w-full justify-center">
                  Share feedback
                </BrickButton>
              </Link>
              <Link href="/set-forecast" onClick={() => setMobileOpen(false)}>
                <BrickButton variant="primary" size="sm" className="w-full justify-center">
                  See forecasts
                </BrickButton>
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
