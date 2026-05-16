"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const brickButtonVariants = cva(
  [
    /* base */
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "border-2 border-jet-black font-medium",
    "transition-all duration-[120ms] ease-out",
    /* focus ring — 3 px Bright Blue at 2 px offset */
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bright-blue focus-visible:ring-offset-2",
    /* disabled */
    "disabled:pointer-events-none disabled:opacity-50",
    /* hover — lift 1 px, grow shadow */
    "hover:-translate-x-px hover:-translate-y-px hover:shadow-click-lg",
    /* active — press 6 px into shadow */
    "active:translate-x-1.5 active:translate-y-1.5 active:shadow-none",
    /* reduced motion */
    "motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-click",
    "motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0 motion-reduce:active:shadow-click",
    "cursor-pointer select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-brick-red text-pure-white",
        secondary: "bg-bright-blue text-pure-white",
        accent: "bg-sunshine-yellow text-jet-black",
        ghost: "bg-transparent text-jet-black",
      },
      size: {
        sm: "h-9 px-4 text-sm rounded-card shadow-click-sm",
        md: "h-11 px-5 text-base rounded-card shadow-click",
        lg: "h-14 px-7 text-lg rounded-card shadow-click",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface BrickButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof brickButtonVariants> {
  icon?: React.ReactNode;
}

const BrickButton = React.forwardRef<HTMLButtonElement, BrickButtonProps>(
  ({ className, variant, size, icon, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(brickButtonVariants({ variant, size }), className)}
      {...props}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
);
BrickButton.displayName = "BrickButton";

export { BrickButton, brickButtonVariants };
