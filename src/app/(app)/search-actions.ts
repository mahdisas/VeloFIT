"use server";

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

/**
 * Clients with a current subscription read as "Active" + a date window; the
 * rest are "Inactive". Mock map today — the live query derives this from the
 * subscriptions ledger (effective_status + start/end dates).
 */
const ACTIVE: Record<string, { from: string; to: string }> = {
  "c-17": { from: "2023-07-01", to: "2026-12-31" },
  "c-202": { from: "2025-10-12", to: "2026-07-10" },
  "c-204": { from: "2026-01-01", to: "2026-12-31" },
  "c-205": { from: "2026-03-01", to: "2027-03-01" },
};

export async function searchClients(query: string): Promise<ClientSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // select id, full_name, phone, avatar_url from clients
  //  where gym_id = (select auth_gym_id())
  //    and (lower(full_name) like :q or phone like :q or national_id like :q)
  //  order by full_name limit 8;
  const clients = await getClients();
  return clients
    .filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.nationalId.includes(q)
    )
    .slice(0, 8)
    .map((c) => {
      const active = ACTIVE[c.id];
      return {
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        avatarUrl: c.avatarUrl,
        status: active ? "active" : "inactive",
        fromDate: active?.from ?? null,
        toDate: active?.to ?? null,
      };
    });
}
