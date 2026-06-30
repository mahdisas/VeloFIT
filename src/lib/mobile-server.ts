import "server-only";

import { type AppViewer } from "@/lib/app-viewer";

/** The current viewer's identity, for the drawer header + Profile screen. */
export type MobileProfile = { fullName: string; phone: string; avatarUrl: string | null };

export async function getViewerProfile(viewer: AppViewer): Promise<MobileProfile> {
  if (viewer.kind === "member") {
    const { data } = await viewer.supabase
      .from("clients")
      .select("full_name, phone, avatar_url")
      .eq("id", viewer.clientId)
      .eq("gym_id", viewer.gymId)
      .maybeSingle();
    return {
      fullName: data?.full_name ?? viewer.name,
      phone: data?.phone ?? "",
      avatarUrl: data?.avatar_url ?? null,
    };
  }
  const { data } = await viewer.supabase
    .from("profiles")
    .select("full_name, phone, avatar_url")
    .eq("id", viewer.userId)
    .maybeSingle();
  return {
    fullName: data?.full_name ?? viewer.name,
    phone: data?.phone ?? "",
    avatarUrl: data?.avatar_url ?? null,
  };
}

/** The gym's display name (for the header / drawer). */
export async function getGymName(viewer: AppViewer): Promise<string> {
  const { data } = await viewer.supabase.from("gyms").select("name").eq("id", viewer.gymId).maybeSingle();
  return data?.name ?? "";
}

/** Gym contact details for the staff Profile screen. `code` is the gym's slug. */
export type GymInfo = { name: string; code: string; phone: string; email: string; address: string };

export async function getGymInfo(viewer: AppViewer): Promise<GymInfo> {
  const { data } = await viewer.supabase
    .from("gyms")
    .select("name, slug, phone, email, address")
    .eq("id", viewer.gymId)
    .maybeSingle();
  return {
    name: data?.name ?? "",
    code: data?.slug ?? "",
    phone: data?.phone ?? "",
    email: data?.email ?? "",
    address: data?.address ?? "",
  };
}

export type MobileSubscription = {
  id: string;
  clientName: string;
  planName: string;
  color: string;
  endDate: string;
  isClassPlan: boolean;
  classesLimit: number | null;
  classesUsed: number;
  /** Outstanding financial balance = price_paid − Σ payments (0 = fully paid). */
  balance: number;
};

type SubRow = {
  id: string;
  end_date: string;
  classes_used: number | null;
  price_paid: number | null;
  client: { full_name: string } | null;
  plan: { name: string; color: string | null; is_class_plan: boolean; classes_limit: number | null; group: { name: string } | null } | null;
};

/**
 * Active (in-date) memberships. For a member it's scoped to THEIR own client row;
 * for staff it's the whole gym. A used-up class pass counts as completed and is
 * excluded (mirrors the client-profile rule).
 */
export async function getViewerSubscriptions(
  viewer: AppViewer
): Promise<{ count: number; items: MobileSubscription[] }> {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;

  let query = viewer.supabase
    .from("subscriptions")
    .select(
      "id, end_date, classes_used, price_paid, client:clients(full_name), plan:subscription_plans(name, color, is_class_plan, classes_limit, group:class_groups(name))"
    )
    .eq("gym_id", viewer.gymId)
    .eq("status", "active")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("end_date", { ascending: true });
  if (viewer.kind === "member") query = query.eq("client_id", viewer.clientId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load subscriptions: ${error.message}`);

  const rows = ((data ?? []) as unknown as SubRow[]).filter((r) => {
    const isClassPlan = r.plan?.is_class_plan ?? false;
    const limit = r.plan?.classes_limit ?? null;
    const used = Number(r.classes_used ?? 0);
    return !(isClassPlan && limit != null && used >= limit); // drop used-up passes
  });

  // Outstanding balance per subscription = price_paid − Σ payments linked to it.
  const paidBySub = new Map<string, number>();
  if (rows.length) {
    const { data: pays } = await viewer.supabase
      .from("payments")
      .select("subscription_id, amount")
      .eq("gym_id", viewer.gymId)
      .in("subscription_id", rows.map((r) => r.id));
    for (const p of (pays ?? []) as { subscription_id: string; amount: number }[]) {
      paidBySub.set(p.subscription_id, (paidBySub.get(p.subscription_id) ?? 0) + Number(p.amount));
    }
  }

  const items = rows.map((r) => {
    const cost = Number(r.price_paid ?? 0);
    const paid = paidBySub.get(r.id) ?? 0;
    return {
      id: r.id,
      clientName: r.client?.full_name ?? "—",
      planName: r.plan?.group?.name ?? r.plan?.name ?? "—",
      color: r.plan?.color ?? "#ec1c79",
      endDate: r.end_date,
      isClassPlan: r.plan?.is_class_plan ?? false,
      classesLimit: r.plan?.classes_limit ?? null,
      classesUsed: Number(r.classes_used ?? 0),
      balance: Math.round((cost - paid) * 100) / 100,
    };
  });

  return { count: items.length, items };
}
