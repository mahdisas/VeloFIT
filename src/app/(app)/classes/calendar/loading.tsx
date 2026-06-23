import { CalendarSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

/** Calendar placeholder: header + control bar + month grid. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <PageHeaderSkeleton />
      <CalendarSkeleton />
    </div>
  );
}
