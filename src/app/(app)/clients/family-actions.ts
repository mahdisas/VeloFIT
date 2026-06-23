"use server";

import { revalidatePath } from "next/cache";

import { getAuthedProfile } from "@/lib/dal";

/**
 * Family-member links between clients. Stored (interim) in
 * gyms.settings.family = { [clientId]: memberClientId[] } until a dedicated
 * family_members table is migrated. Writes go through the cookie client, so the
 * gyms RLS applies (owner/admin may edit gym settings). Links are bidirectional.
 */

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };
export type ClientHit = { id: string; name: string; clientNumber: number };

type FamilyMap = Record<string, string[]>;

/** Up to 8 active clients matching `query`, excluding the client themselves. */
export async function searchFamilyCandidates(clientId: string, query: string): Promise<ClientHit[]> {
  const { supabase, profile } = await getAuthedProfile();

  let q = supabase
    .from("clients")
    .select("id, full_name, client_number")
    .eq("gym_id", profile.gymId)
    .neq("status", "archived")
    .neq("id", clientId)
    .order("full_name")
    .limit(8);

  const trimmed = query.trim();
  if (trimmed) q = q.ilike("full_name", `%${trimmed}%`);

  const { data, error } = await q;
  if (error) return [];
  return ((data ?? []) as { id: string; full_name: string; client_number: number | null }[]).map((c) => ({
    id: c.id,
    name: c.full_name,
    clientNumber: c.client_number ?? 0,
  }));
}

/** Read the gym's settings + family map in one go. */
async function loadSettings(supabase: Awaited<ReturnType<typeof getAuthedProfile>>["supabase"], gymId: string) {
  const { data, error } = await supabase.from("gyms").select("settings").eq("id", gymId).single();
  if (error) throw new Error(error.message);
  const settings = ((data?.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const family = ((settings.family as FamilyMap) ?? {}) as FamilyMap;
  return { settings, family };
}

export async function addFamilyMember(clientId: string, memberId: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  if (clientId === memberId) return { ok: false, error: "A client can't be their own family member." };

  // Both clients must belong to this gym.
  const { data: both } = await supabase
    .from("clients")
    .select("id")
    .eq("gym_id", profile.gymId)
    .in("id", [clientId, memberId]);
  if ((both?.length ?? 0) < 2) return { ok: false, error: "Client not found in this gym." };

  const { settings, family } = await loadSettings(supabase, profile.gymId);
  const link = (a: string, b: string) => {
    const set = new Set(family[a] ?? []);
    set.add(b);
    family[a] = [...set];
  };
  link(clientId, memberId);
  link(memberId, clientId); // bidirectional

  const { error } = await supabase.from("gyms").update({ settings: { ...settings, family } }).eq("id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${memberId}`);
  return { ok: true, id: memberId };
}

export async function removeFamilyMember(clientId: string, memberId: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const { settings, family } = await loadSettings(supabase, profile.gymId);
  const unlink = (a: string, b: string) => {
    family[a] = (family[a] ?? []).filter((x) => x !== b);
    if (family[a].length === 0) delete family[a];
  };
  unlink(clientId, memberId);
  unlink(memberId, clientId);

  const { error } = await supabase.from("gyms").update({ settings: { ...settings, family } }).eq("id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${memberId}`);
  return { ok: true, id: memberId };
}
