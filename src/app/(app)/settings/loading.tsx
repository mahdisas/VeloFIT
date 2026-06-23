import { ListPageSkeleton } from "@/components/skeletons";

/** Closest boundary for Settings sub-sections (locations / measurement types /
 * users / SMS settings). */
export default function Loading() {
  return <ListPageSkeleton />;
}
