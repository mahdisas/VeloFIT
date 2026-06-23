import { ListPageSkeleton } from "@/components/skeletons";

/** Closest boundary for the Classes sub-sections (table / kinds / groups /
 * settings) so switching between them paints a skeleton instantly. The Calendar
 * ships its own (calendar/loading.tsx). */
export default function Loading() {
  return <ListPageSkeleton />;
}
