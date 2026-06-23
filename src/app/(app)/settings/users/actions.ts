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

  // ── Edit: profile update only (no auth changes) ────────────────────────────
  if (v.id) {
    const { error } = await supabase.from("profiles").update(fields).eq("id", v.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.code === "23505" ? DUP : error.message };
    revalidatePath("/settings/users");
    return { ok: true, id: v.id };
  }

  // ── Create: provision an auth account, then the profile row ─────────────────
  if (!v.password || v.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const { data: gym } = await supabase.from("gyms").select("slug").eq("id", profile.gymId).single();
  const slug = (gym?.slug as string | undefined) ?? profile.gymId;
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

  revalidatePath("/settings/users");
  return { ok: true, id: userId };
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
