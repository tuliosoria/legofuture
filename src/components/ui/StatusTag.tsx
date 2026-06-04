import { cn } from "@/lib/utils";
import type { LegoSetStatus } from "@/lib/domain/lego-set";

const STYLES: Record<LegoSetStatus, string> = {
  Active: "bg-slate-100 text-slate-700 border-slate-300",
  "Retiring soon": "bg-sunshine-yellow text-jet-black border-jet-black",
  Retired: "bg-pure-green text-pure-white border-jet-black",
};

interface Props {
  status: LegoSetStatus;
  className?: string;
}

export function StatusTag({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip border px-2 py-0.5 text-[11px] font-medium",
        STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
