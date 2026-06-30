import { MobilePlans } from "@/components/mobile/mobile-plans";
import { getAppViewer } from "@/lib/app-viewer";
import { getWorkoutPlansFor } from "@/lib/workout-plans-server";

/** Plans — the gym's workout plans (read-only list). */
export default async function PlansPage() {
  const viewer = await getAppViewer();
  const plans = await getWorkoutPlansFor(viewer.supabase, viewer.gymId);
  // Don't ship other members' names (plan assignments) to a member's browser.
  const safe =
    viewer.kind === "member" ? plans.map((p) => ({ ...p, assignedClients: [] })) : plans;
  return <MobilePlans plans={safe} />;
}
