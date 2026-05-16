import * as React from "react";
import { cn } from "@/lib/utils";

type DividerColor = "red" | "yellow" | "blue" | "green" | "black";

interface SectionDividerProps {
  color?: DividerColor;
  className?: string;
}

const colorMap: Record<DividerColor, string> = {
  red: "bg-brick-red",
  yellow: "bg-sunshine-yellow",
  blue: "bg-bright-blue",
  green: "bg-pure-green",
  black: "bg-jet-black",
};

/** 16 px full-bleed horizontal color band separating major page sections. */
export function SectionDivider({ color = "yellow", className }: SectionDividerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("w-full h-4", colorMap[color], className)}
    />
  );
}
