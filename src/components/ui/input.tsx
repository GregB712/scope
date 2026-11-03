import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldClass = cn(
  "h-10 w-full rounded-(--radius-control) bg-surface px-3 text-ui text-ink placeholder:text-ink-tertiary",
  "outline-none transition-[box-shadow] duration-150 focus-visible:shadow-[0_0_0_2px_var(--signal)] focus-visible:outline-none",
  "aria-invalid:shadow-[0_0_0_1.5px_var(--danger)]",
);

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClass, "h-auto min-h-20 py-2.5 leading-normal", className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(fieldClass, "appearance-auto pr-2", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-meta font-medium text-ink-secondary", className)}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-meta text-danger">
      {children}
    </p>
  );
}
