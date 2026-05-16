import * as React from "react";
import { cn } from "@/lib/utils";

interface StudStripProps {
  color?: string;
  className?: string;
}

/** Four 8 px filled circles, 8 px gap — evokes a brick stud row. aria-hidden. */
export function StudStrip({ color = "#1B1B1B", className }: StudStripProps) {
  return (
    <svg
      width="56"
      height="8"
      viewBox="0 0 56 8"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {[4, 20, 36, 52].map((cx) => (
        <circle key={cx} cx={cx} cy={4} r={4} fill={color} />
      ))}
    </svg>
  );
}
