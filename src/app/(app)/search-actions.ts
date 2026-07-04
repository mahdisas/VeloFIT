"use server";

import { getAuthedProfile } from "@/lib/dal";
import { getClients } from "@/lib/clients-server";

/** A row in the top-bar client search dropdown. */
export type ClientSearchResult = {
  id: string;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  status: "active" | "inactive";
  fromDate: string | null; // ISO
  toDate: string | null; // ISO
};

type SubWindowRow = {
  client_id: string;
  start_date: string;
  end_date: string;
  classes_used: number | null;
  plan: { is_class_plan: boolean; classes_limit: number | null } | null;
};

/**
 * Top-bar client search. A client reads as "Active" when they hold at least one
 * subscription that is active AND inside its date window today — the same rule
 * as the dashboard and the client profile (a used-up class pass counts as
 * completed and doesn't keep a client active). The badge's date range is the
 * span of their current subscriptions (earliest start → latest end).
 */
export async function searchClients(query: string): Promise<ClientSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const clients = await getClients();
  const matched = clients
    .filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.nationalId.includes(q)
    )
    .slice(0, 8);
  if (matched.length === 0) return [];

  // Live subscription windows for just the matched clients.
  const { supabase, profile } = await getAuthedProfile();
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;

  const { data } = await supabase
    .from("subscriptions")
    .select("client_id, start_date, end_date, classes_used, plan:subscription_plans(is_class_plan, classes_limit)")
    .eq("gym_id", profile.gymId)
    .eq("status", "active")
    .lte("start_date", today)
    .gte("end_date", today)
    .in("client_id", matched.map((c) => c.id));

  // window per client = earliest start → latest end of their current subs.
  const windowBy = new Map<string, { from: string; to: string }>();
  for (const s of ((data ?? []) as unknown as SubWindowRow[])) {
    const usedUpPass =
      (s.plan?.is_class_plan ?? false) &&
      s.plan?.classes_limit != null &&
      Number(s.classes_used ?? 0) >= s.plan.classes_limit;
    if (usedUpPass) continue;
    const cur = windowBy.get(s.client_id);
    windowBy.set(s.client_id, {
      from: cur && cur.from < s.start_date ? cur.from : s.start_date,
      to: cur && cur.to > s.end_date ? cur.to : s.end_date,
    });
  }

  return matched.map((c) => {
    const win = windowBy.get(c.id);
    return {
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      avatarUrl: c.avatarUrl,
      status: win ? "active" : "inactive",
      fromDate: win?.from ?? null,
      toDate: win?.to ?? null,
    };
  });
}
