"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SettingsNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/n/${slug}/settings`;
  const items = [
    { href: base, label: "Newsroom" },
    { href: `${base}/topics`, label: "Topics" },
    { href: `${base}/source`, label: "Google Drive" },
    { href: `${base}/sync`, label: "Sync history" },
    { href: `${base}/account`, label: "Account" },
  ];
  return (
    <nav aria-label="Settings">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href as never}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-(--radius-control) px-3 py-1.5 text-ui whitespace-nowrap",
                  active
                    ? "bg-surface font-medium text-ink"
                    : "text-ink-secondary [@media(hover:hover)]:hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
