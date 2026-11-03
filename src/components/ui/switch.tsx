"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-[1.625rem] w-[2.75rem] shrink-0 rounded-full bg-separator-strong p-[2px] transition-colors duration-200 ease-(--ease-out-strong) data-checked:bg-signal data-disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="size-[1.375rem] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-(--ease-out-strong) data-checked:translate-x-[1.125rem] motion-reduce:transition-none" />
    </SwitchPrimitive.Root>
  );
}
