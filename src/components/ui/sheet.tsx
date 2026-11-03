"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A panel that slides in from an edge and leaves along the same path
 * (apple-design: spatial consistency). Drawer curve, 300 ms in, faster out.
 */
export function Sheet({
  trigger,
  title,
  side = "right",
  children,
}: {
  trigger: ReactNode;
  title: string;
  side?: "right" | "bottom";
  children: ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={trigger as React.ReactElement} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/25 transition-opacity duration-300 ease-(--ease-drawer) data-ending-style:opacity-0 data-ending-style:duration-200 data-starting-style:opacity-0 motion-reduce:transition-none dark:bg-black/55" />
        <Dialog.Popup
          className={cn(
            "fixed z-50 flex flex-col bg-canvas text-ink shadow-[0_8px_40px_rgb(0_0_0/0.18)] outline-none",
            "transition-transform duration-300 ease-(--ease-drawer) data-ending-style:duration-200",
            "motion-reduce:transition-opacity motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:opacity-0",
            side === "right" &&
              "inset-y-0 right-0 w-[min(22rem,88vw)] data-ending-style:translate-x-full data-starting-style:translate-x-full motion-reduce:translate-x-0!",
            side === "bottom" &&
              "inset-x-0 bottom-0 max-h-[80dvh] rounded-t-2xl data-ending-style:translate-y-full data-starting-style:translate-y-full motion-reduce:translate-y-0!",
          )}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <Dialog.Title className="text-title font-semibold">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="pressable -mr-2 grid size-9 place-items-center rounded-full text-ink-secondary [@media(hover:hover)]:hover:bg-surface"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const SheetClose = Dialog.Close;
