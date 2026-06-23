import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type ArchivedUser } from "@/lib/archive/archived-users";

/** Archived (soft-deleted) staff profiles for the gym. */
export async function getArchivedUsers(): Promise<ArchivedUser[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .eq("gym_id", profile.gymId)
    .eq("is_archived", true)
    .order("full_name");

  if (error) throw new Error(`Failed to load archived users: ${error.message}`);

  return ((data ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map((u) => ({
    id: u.id,
    fullName: u.full_name ?? "—",
    phone: u.phone ?? "",
  }));
}
