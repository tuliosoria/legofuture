/**
 * Legacy re-export — maps old Button API to BrickButton.
 * Existing imports of Button/buttonVariants continue to work.
 */
import * as React from "react";
import { BrickButton, brickButtonVariants } from "./BrickButton";
import type { BrickButtonProps } from "./BrickButton";
import { cn } from "@/lib/utils";

// Map old variant names to BrickButton variants
const variantMap: Record<string, "primary" | "secondary" | "accent" | "ghost"> = {
  default: "accent",
  secondary: "secondary",
  outline: "ghost",
  ghost: "ghost",
  destructive: "primary",
};

const sizeMap: Record<string, "sm" | "md" | "lg"> = {
  default: "md",
  sm: "sm",
  lg: "lg",
  icon: "sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className, ...props }, ref) => (
    <BrickButton
      ref={ref}
      variant={variantMap[variant] ?? "accent"}
      size={sizeMap[size] ?? "md"}
      className={className}
      {...(props as Omit<BrickButtonProps, "variant" | "size">)}
    />
  )
);
Button.displayName = "Button";

export { Button, brickButtonVariants as buttonVariants };
export default Button;
