/**
 * Composite loading skeletons shared by route-level `loading.tsx` files. Built
 * from the Shadcn <Skeleton> primitive and mirroring the real page chrome
 * (breadcrumb + title, card-wrapped tables, stat cards, calendar grid) so the
 * instant placeholder matches where the real content lands.
 *
 * Server-renderable (no "use client") — they stream immediately on navigation.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Breadcrumb + page title, optionally with a right-aligned action button. */
export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-10" />
        <span className="text-muted-foreground/40">/</span>
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-52" />
        {withAction && <Skeleton className="h-9 w-32 rounded-lg" />}
      </div>
    </div>
  );
}

/** A card-wrapped data table: search field, header row, body rows, pager. */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="flex flex-col gap-3">
          <div className="flex gap-4 border-b pb-3">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 py-1.5">
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton key={c} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-48" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Row of metric/stat cards (Dashboard, Summary, Workout Plans). */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Grid of content cards (Workout Plans, link landing pages). */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** A month-style calendar grid (Classes · Calendar). */
export function CalendarSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {/* control + nav bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        {/* weekday header */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        {/* day cells */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md sm:h-24" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** The standard list-page placeholder: header + a table. Used by (app)/loading. */
export function ListPageSkeleton({
  withAction = true,
  rows = 8,
  cols = 5,
}: {
  withAction?: boolean;
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <PageHeaderSkeleton withAction={withAction} />
      <TableSkeleton rows={rows} cols={cols} />
    </div>
  );
}
