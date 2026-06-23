import { ListPageSkeleton } from "@/components/skeletons";

/**
 * Group-wide instant placeholder. Applies to every (app) route that doesn't ship
 * its own loading.tsx — most are header + table list pages. The layout (sidebar
 * / topbar) stays mounted; only this content area streams in.
 */
export default function Loading() {
  return <ListPageSkeleton />;
}
