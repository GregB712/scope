import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-display font-semibold text-balance">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-ui text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-separator pb-2">
      <h2 className="text-title font-semibold">{children}</h2>
      {action}
    </div>
  );
}
