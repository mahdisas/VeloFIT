import { PageHeaderSkeleton, StatCardsSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard placeholder: metric cards, charts, then the bottom tables. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={4} />

      {/* Revenue chart + subscription flow */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two donuts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-center py-6">
              <Skeleton className="size-48 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* About-to-expire + recently-added tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-5 w-48" />
              {Array.from({ length: 6 }).map((_, r) => (
                <Skeleton key={r} className="h-5 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
