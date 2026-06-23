import "server-only";

import { createClient } from "@/lib/supabase/server";
import { type IdName } from "@/lib/classes";

/** The cookie-scoped server client (RLS-bound to the caller's gym). */
type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Trainer options come STRICTLY from staff users with role 'trainer' (the
 * `profiles` table). Because `classes.trainer_id` / `workout_plans.trainer_id`
 * are FKs to `trainers`, each trainer-staff is bridged to a `trainers` record
 * (linked via profile_id, created on demand). The returned option value is that
 * trainers.id; the display name is the staff member's full name.
 *
 * Seeded/standalone `trainers` rows that aren't a role='trainer' user are NOT
 * listed — set a user's role to Trainer in Settings · Users to add a trainer.
 * Shared by the Classes wizard and the Workout Plans editor.
 */
export async function listTrainerOptions(supabase: ServerSupabase, gymId: string): Promise<IdName[]> {
  // The trainers = active staff whose role is 'trainer' OR whose "Trainer"
  // permission is enabled (the user form sets the permission flag; role is the
  // schema-level equivalent). Filtered in JS so both sources are honoured.
  const { data: staffData, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, permissions")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .eq("is_archived", false)
    .order("full_name");
  if (error) throw new Error(`Failed to load trainers: ${error.message}`);

  const staff = ((staffData ?? []) as { id: string; full_name: string; role: string; permissions: Record<string, boolean> | null }[])
    .filter((p) => p.role === "trainer" || p.permissions?.trainer === true)
    .map((p) => ({ id: p.id, full_name: p.full_name }));
  if (staff.length === 0) return [];

  // Map each trainer-profile to its trainers.id (the FK target), creating any
  // that don't exist yet so a freshly-promoted trainer is immediately pickable.
  const { data: linked } = await supabase
    .from("trainers")
    .select("id, profile_id")
    .eq("gym_id", gymId)
    .in("profile_id", staff.map((s) => s.id));
  const byProfile = new Map(((linked ?? []) as { id: string; profile_id: string }[]).map((t) => [t.profile_id, t.id]));

  const toCreate = staff
    .filter((s) => !byProfile.has(s.id))
    .map((s) => ({ gym_id: gymId, profile_id: s.id, full_name: s.full_name, is_active: true }));
  if (toCreate.length > 0) {
    const { data: created } = await supabase.from("trainers").insert(toCreate).select("id, profile_id");
    for (const t of (created ?? []) as { id: string; profile_id: string }[]) byProfile.set(t.profile_id, t.id);
  }

  return staff
    .filter((s) => byProfile.has(s.id))
    .map((s) => ({ id: byProfile.get(s.id)!, name: s.full_name }));
}
