import * as React from "react";
import { cn } from "@/lib/utils";
import { StudStrip } from "./StudStrip";

type AccentColor = "red" | "yellow" | "blue" | "green" | "black";

interface BrickCardProps {
  accentTop?: AccentColor;
  studStrip?: boolean;
  compact?: boolean;
  as?: "div" | "article" | "section";
  className?: string;
  children: React.ReactNode;
}

const accentBgMap: Record<AccentColor, string> = {
  red: "bg-brick-red",
  yellow: "bg-sunshine-yellow",
  blue: "bg-bright-blue",
  green: "bg-pure-green",
  black: "bg-jet-black",
};

const accentHexMap: Record<AccentColor, string> = {
  red: "#D01012",
  yellow: "#FFCF00",
  blue: "#006DB7",
  green: "#00852B",
  black: "#1B1B1B",
};

/**
 * Core card surface — white, 2 px black border, radius-card, shadow-click.
 * Optional accentTop band (8 px) and decorative StudStrip overlay.
 */
export function BrickCard({
  accentTop,
  studStrip,
  compact = false,
  as: Tag = "div",
  className,
  children,
}: BrickCardProps) {
  return (
    <Tag
      className={cn(
        "relative overflow-hidden bg-pure-white border-2 border-jet-black rounded-card shadow-click",
        compact ? "p-4" : "p-6",
        className
      )}
    >
      {/* Accent top band */}
      {accentTop && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute top-0 left-0 right-0 h-2",
            accentBgMap[accentTop]
          )}
        />
      )}

      {/* Stud strip overlay */}
      {studStrip && accentTop && (
        <StudStrip
          color={accentHexMap[accentTop]}
          className="absolute top-3 left-3 z-10"
        />
      )}
      {studStrip && !accentTop && (
        <StudStrip className="absolute top-3 left-3 z-10" />
      )}

      {/* Content — pad top to clear accent band when present */}
      <div className={cn(accentTop && "pt-3", studStrip && "pt-6")}>
        {children}
      </div>
    </Tag>
  );
}
