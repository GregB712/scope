import { cn } from "@/lib/utils";

/**
 * Importance as a tabular numeral plus a 10-step hairline meter. High scores use
 * the signal color; there is no red/green semantics.
 */
export function Importance({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return null;
  const tone = value >= 8 ? "text-signal" : value >= 5 ? "text-ink" : "text-ink-tertiary";
  return (
    <span
      role="img"
      aria-label={`Importance ${value} of 10`}
      title={`Importance ${value} of 10`}
      className={cn("inline-flex items-center gap-1.5", tone, className)}
    >
      <span className="tabular text-meta font-semibold">{value}</span>
      <span aria-hidden className="flex gap-[2px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 w-[2px] rounded-full",
              i < value ? "bg-current" : "bg-separator-strong",
            )}
          />
        ))}
      </span>
    </span>
  );
}
