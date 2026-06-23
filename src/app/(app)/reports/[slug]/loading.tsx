import { PageHeaderSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant placeholder for every report page (/reports/[slug]). Report pages
 * fetch real, gym-scoped data, so this paints immediately on navigation: the
 * filter/export toolbar plus a table.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <PageHeaderSkeleton />

      <Card>
        <CardContent className="flex flex-col gap-6">
          {/* Filters + search + export toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-full max-w-sm" />
            <Skeleton className="h-9 w-40" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="size-9" />
              <Skeleton className="size-9" />
              <Skeleton className="size-9" />
            </div>
          </div>

          {/* Table header + rows */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-4 border-b pb-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
              ))}
            </div>
            {Array.from({ length: 9 }).map((_, r) => (
              <div key={r} className="flex items-center gap-4 py-1.5">
                {Array.from({ length: 6 }).map((_, c) => (
                  <Skeleton key={c} className="h-4 flex-1" />
                ))}
              </div>
            ))}
          </div>

          {/* Pager */}
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-56" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
