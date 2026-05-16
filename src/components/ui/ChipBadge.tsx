"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ChipColor = "red" | "yellow" | "blue" | "green" | "black" | "slate";

interface ChipBadgeProps {
  color: ChipColor;
  active?: boolean;
  onClick?: () => void;
  as?: "button" | "span";
  className?: string;
  children: React.ReactNode;
}

const bgMap: Record<ChipColor, string> = {
  red: "bg-brick-red text-pure-white",
  yellow: "bg-sunshine-yellow text-jet-black",
  blue: "bg-bright-blue text-pure-white",
  green: "bg-pure-green text-pure-white",
  black: "bg-jet-black text-pure-white",
  slate: "bg-slate-300 text-jet-black",
};

const base =
  "inline-flex items-center justify-center border-2 border-jet-black rounded-chip px-3 py-1 type-body-sm uppercase tracking-wider transition-all duration-[120ms] select-none";

/** Filled chip badge for recommendation, scenario, status, theme filters. */
export function ChipBadge({
  color,
  active = false,
  onClick,
  as,
  className,
  children,
}: ChipBadgeProps) {
  const isButton = onClick != null || as === "button";
  const Tag = isButton ? "button" : "span";

  return (
    <Tag
      {...(isButton ? { onClick, type: "button" as const } : {})}
      className={cn(
        base,
        bgMap[color],
        active && "border-[3px]",
        isButton && "cursor-pointer hover:brightness-110",
        className
      )}
    >
      {children}
    </Tag>
  );
}
