import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

/** Brick-styled input — 2 px border, radius-card, blue focus ring, red error state. */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-card border-2 bg-pure-white px-3 py-2 text-base text-jet-black",
        "placeholder:text-slate-500",
        /* default border */
        error ? "border-brick-red" : "border-jet-black",
        /* focus ring */
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bright-blue focus-visible:ring-offset-0",
        /* disabled */
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
