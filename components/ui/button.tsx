"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-55",
        variant === "primary" && "border-primary bg-primary text-primary-foreground hover:opacity-90",
        variant === "secondary" && "border-border bg-secondary text-secondary-foreground hover:bg-muted",
        variant === "ghost" && "border-transparent bg-transparent text-foreground hover:bg-muted",
        variant === "danger" && "border-destructive bg-destructive text-destructive-foreground hover:opacity-90",
        size === "sm" && "h-11 px-3 sm:h-8",
        size === "md" && "h-11 px-4 sm:h-10",
        size === "icon" && "h-11 w-11 p-0 sm:h-9 sm:w-9",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
