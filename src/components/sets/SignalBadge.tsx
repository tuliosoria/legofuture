import type { Recommendation } from "@/lib/types/lego";

const LABELS: Record<Recommendation, string> = {
  buy: "Buy",
  hold: "Hold",
  sell: "Sell",
};

const STYLES: Record<Recommendation, string> = {
  buy: "bg-bright-blue text-pure-white border-jet-black",
  hold: "bg-sunshine-yellow text-jet-black border-jet-black",
  sell: "bg-jet-black text-pure-white border-jet-black",
};

export function SignalBadge({
  recommendation,
  size = "md",
}: {
  recommendation: Recommendation;
  size?: "sm" | "md";
}) {
  const sizing =
    size === "sm"
      ? "px-3 py-1 text-[11px] tracking-[0.14em]"
      : "px-4 py-1.5 text-xs tracking-[0.16em]";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border-2 font-extrabold uppercase shadow-[0_2px_0_rgba(0,0,0,0.18)] ${sizing} ${STYLES[recommendation]}`}
    >
      {LABELS[recommendation]}
    </span>
  );
}
