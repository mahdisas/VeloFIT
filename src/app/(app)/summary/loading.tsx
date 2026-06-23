import { PageHeaderSkeleton, StatCardsSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Summary placeholder: metric cards + breakdown panels. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
