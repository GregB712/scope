"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

const isActive = (pathname: string, item: NavItem) =>
  item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

/** Primary navigation. No animation: it is used many times a day (emil-design-eng). */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href as never}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-ui",
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

export function MobileNav({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="md:hidden">
      <Sheet
        title="Menu"
        trigger={
          <button
            type="button"
            aria-label="Open menu"
            className="pressable -ml-2 grid size-10 place-items-center rounded-full text-ink"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        }
      >
        <ul className="hairline-list">
          {items.map((item) => (
            <li key={item.href}>
              <SheetClose
                render={<Link href={item.href as never} />}
                aria-current={isActive(pathname, item) ? "page" : undefined}
                className="block py-3 text-title aria-[current=page]:font-semibold"
              >
                {item.label}
              </SheetClose>
            </li>
          ))}
        </ul>
        {footer && <div className="mt-6 text-meta text-ink-secondary">{footer}</div>}
      </Sheet>
    </div>
  );
}
