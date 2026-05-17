"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: boolean;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      step="any"
      className={cn(
        "flex h-11 w-full rounded-card border-2 bg-pure-white px-3 py-2 text-base text-jet-black",
        "placeholder:text-slate-500",
        error ? "border-brick-red" : "border-jet-black",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bright-blue",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
NumberInput.displayName = "NumberInput";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="type-body-sm font-medium text-jet-black mb-1 block">{children}</label>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-brick-red mt-1">{message}</p>;
}

export function ResultRow({
  label,
  value,
  emphasize = false,
  positive,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  positive?: boolean;
}) {
  const valColor =
    positive === undefined
      ? "text-jet-black"
      : positive
      ? "text-emerald-600"
      : "text-brick-red";
  return (
    <div
      className={cn(
        "flex items-baseline justify-between py-2 border-b border-slate-200 last:border-b-0",
        emphasize && "font-semibold"
      )}
    >
      <span className="type-body-sm text-slate-700">{label}</span>
      <span className={cn("tabular-nums", emphasize ? "text-lg" : "text-base", valColor)}>
        {value}
      </span>
    </div>
  );
}

export const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export const fmtPct = (n: number) =>
  `${(n * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
