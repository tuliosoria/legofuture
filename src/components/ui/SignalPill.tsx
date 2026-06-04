import { cn } from "@/lib/utils";
import type { LegoSetSignal } from "@/lib/domain/lego-set";

const STYLES: Record<LegoSetSignal, string> = {
  "Strong Buy": "bg-brick-red text-pure-white",
  Buy: "bg-bright-blue text-pure-white",
  Watch: "bg-sunshine-yellow text-jet-black",
  Hold: "bg-sunshine-yellow text-jet-black",
  Sell: "bg-slate-700 text-pure-white",
};

interface Props {
  signal: LegoSetSignal;
  size?: "sm" | "md";
  className?: string;
}

export function SignalPill({ signal, size = "md", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border-2 border-jet-black font-semibold uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        STYLES[signal],
        className,
      )}
    >
      {signal}
    </span>
  );
}
