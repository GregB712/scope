import type { ReactNode } from "react";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-separator pt-6 pb-12 first:border-t-0 first:pt-0">
      <h2 className="text-headline font-semibold">{title}</h2>
      {description && (
        <div className="mt-1.5 max-w-2xl text-ui text-ink-secondary">{description}</div>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}
