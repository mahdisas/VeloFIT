import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Workout Plans placeholder: 3 stat cards, a filter bar, then the plan grid. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <PageHeaderSkeleton />

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4">
              <Skeleton className="size-11 rounded-lg" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-9 w-full max-w-sm" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32 sm:ml-auto" />
        </CardContent>
      </Card>

      <CardGridSkeleton count={6} />
    </div>
  );
}
