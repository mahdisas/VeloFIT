"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";
import { STAFF_EMAIL_DOMAIN } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { type Permissions } from "@/lib/settings/users";

/**
 * Staff User mutations. Only owners/admins may manage staff. Editing/archiving
 * goes through the cookie client (RLS: "profiles: admins manage staff").
 * Creating a user and resetting a password need the Auth Admin API (service
 * role), so we authorize manually first.
 *
 * Login is email-based but the form collects a username, so a new account gets
 * a synthesized login email: <username>@<gym-slug>.<STAFF_EMAIL_DOMAIN>.
 */

export type UserInput = {
  id?: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  hourlyRate: number;
  password?: string;
  permissions: Permissions;
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const PERMISSION_KEYS = [
  "classesManagement",
  "trainer",
  "secretary",
  "addUpdate",
  "delete",
  "memberApplication",
  "financeReports",
  "reports",
] as const;

const permissionsSchema = z.object(
  Object.fromEntries(PERMISSION_KEYS.map((k) => [k, z.boolean()])) as Record<(typeof PERMISSION_KEYS)[number], z.ZodBoolean>
);

const schema = z.object({
  id: z.string().optional(),
  username: z.string().trim().min(1, "Username is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  phone: z.string().trim().min(1, "Phone number is required"),
  hourlyRate: z.number().min(0),
  password: z.string().optional(),
  permissions: permissionsSchema,
});

const DUP = "A user with this username already exists.";

export async function saveUser(input: UserInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  if (profile.role !== "owner" && profile.role !== "admin") {
    return { ok: false, error: "You don't have permission to manage staff." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const fullName = `${v.firstName.trim()} ${v.lastName.trim()}`.trim();
  const fields = {
    username: v.username.trim(),
    first_name: v.firstName.trim(),
    last_name: v.lastName.trim(),
    full_name: fullName,
    phone: v.phone.trim(),
    hourly_rate: v.hourlyRate,
    permissions: v.permissions,
  };

  // ── Edit: profile update, then sync the login email + trainers roster ───────
  if (v.id) {
    // Need the current username to know whether the login email must change.
    const { data: existing } = await supabase
      .from("profiles").select("username").eq("id", v.id).eq("gym_id", profile.gymId).maybeSingle();
    if (!existing) return { ok: false, error: "User not found in this gym." };

    const { error } = await supabase.from("profiles").update(fields).eq("id", v.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.code === "23505" ? DUP : error.message };

    const admin = createAdminClient();

    // Issue 1 — a changed username must re-point the synthesized login email,
    // otherwise the person still signs in with their OLD username. The profile
    // update above already enforced username uniqueness (so the new email is
    // unique too); update it only when it actually changed.
    const oldUsername = (existing.username ?? "").trim().toLowerCase();
    const newUsername = v.username.trim().toLowerCase();
    if (newUsername !== oldUsername) {
      const slug = await gymSlug(supabase, profile.gymId);
      const { error: emailError } = await admin.auth.admin.updateUserById(v.id, {
        email: `${newUsername}@${slug}.${STAFF_EMAIL_DOMAIN}`,
        email_confirm: true,
      });
      if (emailError) {
        return { ok: false, error: `Saved, but the login username couldn't be updated: ${emailError.message}` };
      }
    }

    // Issues 2 & 3 — keep the assignable-trainers roster in sync (name + membership).
    await syncTrainerRoster(admin, profile.gymId, v.id, fullName, v.permissions.trainer);

    revalidatePath("/settings/users");
    return { ok: true, id: v.id };
  }

  // ── Create: provision an auth account, the profile row, then the trainer ────
  if (!v.password || v.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const slug = await gymSlug(supabase, profile.gymId);
  const email = `${v.username.trim().toLowerCase()}@${slug}.${STAFF_EMAIL_DOMAIN}`;

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: v.password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    return { ok: false, error: authError?.message ?? "Failed to create the auth account." };
  }
  const userId = created.user.id;

  // New staff default to the least-privileged role; the permission flags layer on top.
  const { error: profileError } = await admin.from("profiles").upsert(
    { id: userId, gym_id: profile.gymId, role: "receptionist", is_active: true, is_archived: false, ...fields },
    { onConflict: "id" }
  );
  if (profileError) {
    await admin.auth.admin.deleteUser(userId); // roll back the orphan auth user
    return { ok: false, error: profileError.code === "23505" ? DUP : profileError.message };
  }

  // Issue 3 — add the new staff to the trainers roster if they're a Trainer.
  await syncTrainerRoster(admin, profile.gymId, userId, fullName, v.permissions.trainer);

  revalidatePath("/settings/users");
  return { ok: true, id: userId };
}

type AdminClient = ReturnType<typeof createAdminClient>;
type ServerClient = Awaited<ReturnType<typeof getAuthedProfile>>["supabase"];

/** The gym's slug (for the synthesized login email); falls back to the gym id. */
async function gymSlug(supabase: ServerClient, gymId: string): Promise<string> {
  const { data } = await supabase.from("gyms").select("slug").eq("id", gymId).single();
  return (data?.slug as string | undefined) ?? gymId;
}

/**
 * Keep the assignable-trainers roster in sync with a staff profile:
 *   • Issue 2 — refresh the trainer's name (no-op if they have no trainer row).
 *   • Issue 3 — ensure a trainer row exists when they hold the Trainer permission.
 * Best-effort: a hiccup here never fails the user save. The upsert relies on the
 * unique index on trainers(gym_id, profile_id) (migration 00014).
 */
async function syncTrainerRoster(
  admin: AdminClient,
  gymId: string,
  profileId: string,
  fullName: string,
  isTrainer: boolean
): Promise<void> {
  // Issue 2: refresh the name on an existing trainer row (matches by profile_id).
  await admin.from("trainers").update({ full_name: fullName }).eq("gym_id", gymId).eq("profile_id", profileId);

  // Issue 3: ensure roster membership; ON CONFLICT DO NOTHING (the update above
  // already handled the name) makes it idempotent and race-proof.
  if (isTrainer) {
    await admin
      .from("trainers")
      .upsert(
        { gym_id: gymId, profile_id: profileId, full_name: fullName, is_active: true },
        { onConflict: "gym_id,profile_id", ignoreDuplicates: true }
      );
  }
}

/** Soft-archive → Archive · Users. The auth account is kept for history. */
export async function deleteUser(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  if (profile.role !== "owner" && profile.role !== "admin") {
    return { ok: false, error: "You don't have permission to manage staff." };
  }
  if (id === profile.userId) return { ok: false, error: "You can't archive your own account." };

  const { error } = await supabase
    .from("profiles")
    .update({ is_archived: true, is_active: false })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/users");
  revalidatePath("/archive/users");
  return { ok: true, id };
}

export async function resetUserPassword(id: string, password: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  if (profile.role !== "owner" && profile.role !== "admin") {
    return { ok: false, error: "You don't have permission to manage staff." };
  }
  if (!password || password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  // Confirm the target lives in this gym before using the RLS-bypassing admin client.
  const { data: target } = await supabase.from("profiles").select("id").eq("id", id).eq("gym_id", profile.gymId).maybeSingle();
  if (!target) return { ok: false, error: "User not found in this gym." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, error: error.message };

  return { ok: true, id };
}
