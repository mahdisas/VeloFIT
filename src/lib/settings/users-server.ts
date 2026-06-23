import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { emptyPermissions, type Permissions, type StaffUser } from "@/lib/settings/users";

/** Active (non-archived) staff profiles for the signed-in gym. */
export async function getUsers(): Promise<StaffUser[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, full_name, phone, hourly_rate, permissions")
    .eq("gym_id", profile.gymId)
    .eq("is_archived", false)
    .order("created_at");

  if (error) throw new Error(`Failed to load users: ${error.message}`);

  return ((data ?? []) as ProfileRow[]).map((u) => ({
    id: u.id,
    username: u.username ?? "",
    firstName: u.first_name ?? "",
    lastName: u.last_name ?? "",
    fullName: u.full_name ?? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
    phone: u.phone ?? "",
    hourlyRate: Number(u.hourly_rate),
    permissions: { ...emptyPermissions(), ...((u.permissions as Partial<Permissions>) ?? {}) },
  }));
}

type ProfileRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  hourly_rate: number;
  permissions: Record<string, boolean> | null;
};
