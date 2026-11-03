import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchField({
  defaultValue,
  placeholder = "Search",
  autoFocus,
  className,
}: {
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary"
      />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        maxLength={200}
        className="h-10 w-full rounded-full bg-surface pr-4 pl-9 text-ui text-ink outline-none placeholder:text-ink-tertiary focus-visible:shadow-[0_0_0_2px_var(--signal)] focus-visible:outline-none"
      />
    </div>
  );
}
