import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Empty screens say what to do next (frontend-design: emptiness is direction). */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center py-20 text-center", className)}>
      <h2 className="font-serif text-headline font-semibold">{title}</h2>
      {children && <div className="mt-2 text-ui text-ink-secondary">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warning";
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-(--radius-control) bg-surface px-4 py-3 text-meta",
        tone === "warning" ? "text-warning" : "text-ink-secondary",
      )}
    >
      {children}
    </div>
  );
}
