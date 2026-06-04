import { cn } from "@/lib/utils";

interface Props {
  filled: number;
  total?: number;
  className?: string;
  size?: "sm" | "md";
  label?: string;
}

export function ConfidenceDots({ filled, total = 5, className, size = "md", label }: Props) {
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      role="img"
      aria-label={label ?? `${filled} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full border",
            dotSize,
            i < filled ? "border-jet-black" : "border-slate-300",
          )}
          style={{ background: i < filled ? "#1D9E75" : "transparent" }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
