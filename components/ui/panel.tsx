import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn("min-w-0 rounded-lg border bg-card/90 text-card-foreground shadow-panel", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({
  className,
  children
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-3 pt-4 sm:px-5 sm:pt-5", className)}>{children}</div>;
}

export function PanelBody({
  className,
  children
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}
