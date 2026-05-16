import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrickButton } from "./BrickButton";

type AccentColor = "yellow" | "red" | "blue" | "green";

interface Cta {
  label: string;
  href: string;
}

interface BrickHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  primaryCta: Cta;
  secondaryCta?: Cta;
  accentColor?: AccentColor;
  className?: string;
}

const accentBgMap: Record<AccentColor, string> = {
  yellow: "bg-sunshine-yellow",
  red: "bg-brick-red",
  blue: "bg-bright-blue",
  green: "bg-pure-green",
};

const accentTextMap: Record<AccentColor, string> = {
  yellow: "text-jet-black",
  red: "text-pure-white",
  blue: "text-pure-white",
  green: "text-pure-white",
};

/** Decorative SVG — 3 stacked rotated rectangles with hard borders and click shadow. */
function BrickIllustration() {
  return (
    <svg
      viewBox="0 0 220 260"
      width="220"
      height="260"
      aria-hidden="true"
      className="shrink-0 w-40 md:w-56"
    >
      {/* Shadow layers */}
      <rect x="34" y="174" width="140" height="80" rx="6" fill="#1B1B1B" transform="rotate(-3 104 214)" />
      <rect x="28" y="94" width="148" height="78" rx="6" fill="#1B1B1B" transform="rotate(4 102 133)" />
      <rect x="18" y="18" width="156" height="70" rx="6" fill="#1B1B1B" transform="rotate(-2 96 53)" />
      {/* Colored rectangles */}
      <rect x="30" y="170" width="140" height="80" rx="6" fill="#FFCF00" stroke="#1B1B1B" strokeWidth="2" transform="rotate(-3 100 210)" />
      <rect x="24" y="90" width="148" height="78" rx="6" fill="#006DB7" stroke="#1B1B1B" strokeWidth="2" transform="rotate(4 98 129)" />
      <rect x="14" y="14" width="156" height="70" rx="6" fill="#D01012" stroke="#1B1B1B" strokeWidth="2" transform="rotate(-2 92 49)" />
    </svg>
  );
}

/**
 * Full-bleed hero block with eyebrow, display headline, description,
 * primary + optional secondary CTA, and decorative brick illustration.
 */
export function BrickHero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  accentColor = "yellow",
  className,
}: BrickHeroProps) {
  const bgClass = accentBgMap[accentColor];
  const textClass = accentTextMap[accentColor];

  return (
    <section
      className={cn(
        "w-full py-16 md:py-20 px-4",
        bgClass,
        className
      )}
    >
      <div className="mx-auto max-w-[1240px] flex flex-col md:flex-row items-center gap-10">
        {/* Text */}
        <div className={cn("flex-1 min-w-0", textClass)}>
          {eyebrow && (
            <p className="type-eyebrow mb-4 opacity-80">{eyebrow}</p>
          )}
          <h1 className="type-display-1 mb-4 max-w-xl">{title}</h1>
          {description && (
            <p className="type-body-lg mb-8 max-w-lg opacity-90">{description}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href={primaryCta.href}>
              <BrickButton
                variant={accentColor === "yellow" ? "primary" : "accent"}
                size="lg"
              >
                {primaryCta.label}
              </BrickButton>
            </Link>
            {secondaryCta && (
              <Link href={secondaryCta.href}>
                <BrickButton variant="ghost" size="lg">
                  {secondaryCta.label}
                </BrickButton>
              </Link>
            )}
          </div>
        </div>

        {/* Illustration */}
        <div className="flex-shrink-0 flex items-center justify-center">
          <BrickIllustration />
        </div>
      </div>
    </section>
  );
}
