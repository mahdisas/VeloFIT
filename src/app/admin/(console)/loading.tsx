import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant skeleton for the gyms list. Mirrors (console)/page.tsx so there's no
 * layout shift when the real content swaps in, and navigating into the console
 * shows this immediately instead of a frozen page.
 */
export default function AdminGymsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-4 w-16 sm:block" />
            <Skeleton className="size-5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
