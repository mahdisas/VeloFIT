import "server-only";

import { type createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

type ClassPassRow = {
  id: string;
  classes_used: number | null;
  end_date: string;
  plan: { is_class_plan: boolean; classes_limit: number | null } | null;
};

/**
 * Consume one class credit (delta = +1) — or refund one (delta = -1) — on the
 * client's active class-pass subscription (כרטיסייה).
 *
 * Strict limit: a +1 only ever lands on a pass that still has room (soonest
 * expiry first), and classes_used is hard-capped at classes_limit, so a punch
 * card can never go over its quota. If every pass is full, a +1 is a no-op (the
 * client is out of credits — the front desk should renew). A −1 refunds a pass
 * that has credits to give back. An unlimited pass (classes_limit = null) just
 * counts up. A client with no active class pass is a no-op; never goes below 0.
 *
 * Best-effort: punch-card tracking must NEVER break attendance logging, so this
 * swallows its own errors.
 */
export async function consumeClassPass(
  supabase: ServerSupabase,
  gymId: string,
  clientId: string,
  delta: number
): Promise<void> {
  try {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;

    const { data } = await supabase
      .from("subscriptions")
      .select("id, classes_used, end_date, plan:subscription_plans(is_class_plan, classes_limit)")
      .eq("gym_id", gymId)
      .eq("client_id", clientId)
      .eq("status", "active")
      .lte("start_date", today)
      .gte("end_date", today);

    const passes = ((data ?? []) as unknown as ClassPassRow[]).filter((s) => s.plan?.is_class_plan);
    if (passes.length === 0) return;

    const used = (s: ClassPassRow) => Number(s.classes_used ?? 0);
    const limit = (s: ClassPassRow) => s.plan?.classes_limit ?? null;
    // +1 wants a pass with remaining credit; −1 wants a pass with something to
    // refund. Either way, burn/return the soonest-expiring eligible pass first.
    const eligible = passes
      .filter((s) => (delta >= 0 ? limit(s) == null || used(s) < limit(s)! : used(s) > 0))
      .sort((a, b) => a.end_date.localeCompare(b.end_date));
    const target = eligible[0];
    if (!target) return; // out of credits (+1) or nothing to refund (−1)

    const cap = limit(target);
    let next = used(target) + delta;
    if (next < 0) next = 0;
    if (cap != null && next > cap) next = cap; // strict: never exceed the quota
    await supabase.from("subscriptions").update({ classes_used: next }).eq("id", target.id).eq("gym_id", gymId);
  } catch {
    // best-effort — never propagate
  }
}
