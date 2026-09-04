import * as React from "react";
import { cn } from "@/lib/utils";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Field({ label, className, id, ...props }: FieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? props.name ?? generatedId;
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground" htmlFor={fieldId}>
      <span>{label}</span>
      <input
        id={fieldId}
        className={cn(
          "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25",
          className
        )}
        {...props}
      />
    </label>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function TextareaField({ label, className, id, ...props }: TextareaProps) {
  const generatedId = React.useId();
  const fieldId = id ?? props.name ?? generatedId;
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground" htmlFor={fieldId}>
      <span>{label}</span>
      <textarea
        id={fieldId}
        className={cn(
          "min-h-20 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25",
          className
        )}
        {...props}
      />
    </label>
  );
}
