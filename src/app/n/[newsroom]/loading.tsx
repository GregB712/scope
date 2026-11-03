import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the pages it stands in for, so content does not jump when it arrives. */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="grid grid-cols-[minmax(0,1fr)] gap-16 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-12 w-4/5" />
        <Skeleton className="mt-3 h-12 w-3/5" />
        <div className="mt-10 space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
      <div className="space-y-6">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
