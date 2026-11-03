import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import type { AuthorizedNewsroom } from "@/server/auth";
import { MobileNav, NavLinks } from "./nav";
import { navItems } from "./nav-items";
import { SyncStatus } from "./sync-status";

/** Translucent top bar; content scrolls underneath (apple-design: materials). */
export function TopBar({ newsroom }: { newsroom: AuthorizedNewsroom }) {
  const items = navItems(newsroom.slug);
  return (
    <header className="material-bar sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5 sm:px-8">
        <MobileNav items={items} />
        <Link href={`/n/${newsroom.slug}`} className="flex min-w-0 items-baseline gap-2">
          <span className="font-serif text-[1.25rem] font-semibold tracking-[-0.01em]">Scope</span>
          <span className="hidden truncate text-meta text-ink-tertiary lg:inline">
            {newsroom.name}
          </span>
        </Link>
        <div className="flex flex-1 justify-center">
          <NavLinks items={items} />
        </div>
        <div className="flex items-center gap-4">
          <Suspense fallback={null}>
            <SyncStatus newsroom={newsroom} className="hidden whitespace-nowrap sm:inline" />
          </Suspense>
          {/* Reserve the avatar's space so the bar does not shift when Clerk loads. */}
          <div className="grid size-7 place-items-center">
            <UserButton />
          </div>
        </div>
      </div>
    </header>
  );
}
