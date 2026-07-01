"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { staffEmail } from "@/lib/auth";
import { getPlatformAdmin } from "@/lib/platform-admin";

/**
 * Platform (super-admin) console actions. Every one calls getPlatformAdmin()
 * first, then uses the returned service-role client (RLS-bypassing) to work
 * across tenants. No client-supplied id is trusted without a scoping check.
 *
 * User provisioning mirrors the per-gym pattern in
 * app/(app)/settings/users/actions.ts (create auth user → upsert profile → roll
 * back the orphan auth user on failure). Login emails are synthesized as
 * <username>@<gym-slug>.<domain> via staffEmail(), the single source of truth.
 */

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const ROLES = ["owner", "admin", "manager", "trainer", "receptionist"] as const;
export type GymUserRole = (typeof ROLES)[number];

const PERMISSION_KEYS = [
  "classesManagement", "trainer", "secretary", "addUpdate",
  "delete", "memberApplication", "financeReports", "reports",
] as const;
const FULL_PERMISSIONS = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));

// ── Reads ───────────────────────────────────────────────────────────────────

export type GymRow = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  messagesBalance: number;
  createdAt: string;
  userCount: number;
  memberCount: number;
};

export async function listGyms(): Promise<GymRow[]> {
  const { admin } = await getPlatformAdmin();

  const { data: gyms } = await admin
    .from("gyms")
    .select("id, name, slug, is_active, messages_balance, created_at")
    .order("created_at", { ascending: false });
  const rows = (gyms ?? []) as {
    id: string; name: string; slug: string; is_active: boolean; messages_balance: number; created_at: string;
  }[];
  if (rows.length === 0) return [];

  // Per-gym counts via fast indexed head-counts (gym_id is indexed), all in
  // parallel — avoids streaming every profile/client row across all tenants.
  const counts = await Promise.all(
    rows.map(async (g) => {
      const [users, members] = await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("gym_id", g.id).eq("is_archived", false),
        admin.from("clients").select("id", { count: "exact", head: true }).eq("gym_id", g.id).neq("status", "archived"),
      ]);
      return [g.id, { users: users.count ?? 0, members: members.count ?? 0 }] as const;
    })
  );
  const countBy = new Map(counts);

  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    code: g.slug,
    isActive: g.is_active,
    messagesBalance: Number(g.messages_balance ?? 0),
    createdAt: g.created_at,
    userCount: countBy.get(g.id)?.users ?? 0,
    memberCount: countBy.get(g.id)?.members ?? 0,
  }));
}

export type GymDetail = {
  id: string; name: string; code: string; isActive: boolean;
  messagesBalance: number; createdAt: string;
};
export type GymUser = {
  id: string; username: string; fullName: string; role: string; isActive: boolean; isArchived: boolean;
};

export async function getGymDetail(gymId: string): Promise<{ gym: GymDetail; users: GymUser[] } | null> {
  const { admin } = await getPlatformAdmin();

  const { data: g } = await admin
    .from("gyms")
    .select("id, name, slug, is_active, messages_balance, created_at")
    .eq("id", gymId)
    .maybeSingle();
  if (!g) return null;
  const gg = g as { id: string; name: string; slug: string; is_active: boolean; messages_balance: number; created_at: string };

  const { data: us } = await admin
    .from("profiles")
    .select("id, username, full_name, role, is_active, is_archived")
    .eq("gym_id", gymId)
    .order("is_archived")
    .order("full_name");
  const users = ((us ?? []) as {
    id: string; username: string | null; full_name: string | null; role: string; is_active: boolean; is_archived: boolean;
  }[]).map((u) => ({
    id: u.id, username: u.username ?? "", fullName: u.full_name ?? "—",
    role: u.role, isActive: u.is_active, isArchived: u.is_archived,
  }));

  return {
    gym: {
      id: gg.id, name: gg.name, code: gg.slug, isActive: gg.is_active,
      messagesBalance: Number(gg.messages_balance ?? 0), createdAt: gg.created_at,
    },
    users,
  };
}

// ── Gym create / update ───────────────────────────────────────────────────────

const codeRule = z
  .string().trim().min(2, "Gym code must be at least 2 characters")
  .regex(/^[a-z0-9-]+$/i, "Gym code can only contain letters, numbers, and hyphens");

const createGymSchema = z.object({
  name: z.string().trim().min(1, "Gym name is required"),
  code: codeRule,
  ownerUsername: z.string().trim().min(1, "Owner username is required"),
  ownerFullName: z.string().trim().optional(),
  ownerPassword: z.string().min(6, "Password must be at least 6 characters"),
});
export type CreateGymInput = z.infer<typeof createGymSchema>;

export async function createGymWithOwner(input: CreateGymInput): Promise<ActionResult> {
  const { admin } = await getPlatformAdmin();
  const parsed = createGymSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const code = v.code.trim().toLowerCase();

  // 1) Gym (slug must be unique).
  const { data: gymRow, error: gymErr } = await admin
    .from("gyms").insert({ name: v.name.trim(), slug: code }).select("id").single();
  if (gymErr || !gymRow) {
    return { ok: false, error: gymErr?.code === "23505" ? "A gym with this code already exists." : (gymErr?.message ?? "Failed to create gym.") };
  }
  const gymId = (gymRow as { id: string }).id;

  // 2) Owner auth account.
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: staffEmail(v.ownerUsername, code), password: v.ownerPassword, email_confirm: true,
  });
  if (authErr || !created.user) {
    await admin.from("gyms").delete().eq("id", gymId); // roll back the empty gym
    return { ok: false, error: authErr?.message ?? "Failed to create the owner account." };
  }
  const userId = created.user.id;

  // 3) Owner profile (full access).
  const { error: profErr } = await admin.from("profiles").upsert(
    {
      id: userId, gym_id: gymId, role: "owner",
      username: v.ownerUsername.trim(), full_name: v.ownerFullName?.trim() || v.ownerUsername.trim(),
      permissions: FULL_PERMISSIONS, is_active: true, is_archived: false,
    },
    { onConflict: "id" }
  );
  if (profErr) {
    await admin.auth.admin.deleteUser(userId);
    await admin.from("gyms").delete().eq("id", gymId);
    return { ok: false, error: profErr.code === "23505" ? "A user with this username already exists." : profErr.message };
  }

  revalidatePath("/admin");
  return { ok: true, id: gymId };
}

const updateGymSchema = z.object({
  gymId: z.string().min(1),
  name: z.string().trim().min(1, "Gym name is required"),
  messagesBalance: z.number().int().min(0),
});

export async function updateGym(input: z.infer<typeof updateGymSchema>): Promise<ActionResult> {
  const { admin } = await getPlatformAdmin();
  const parsed = updateGymSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  // Gym code (slug) is intentionally immutable — it's baked into every staff
  // login email, so renaming it would lock users out. Create a new gym instead.
  const { error } = await admin
    .from("gyms")
    .update({ name: v.name.trim(), messages_balance: v.messagesBalance })
    .eq("id", v.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/gyms/${v.gymId}`);
  return { ok: true, id: v.gymId };
}

export async function setGymActive(gymId: string, active: boolean): Promise<ActionResult> {
  const { admin } = await getPlatformAdmin();
  const { error } = await admin.from("gyms").update({ is_active: active }).eq("id", gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath(`/admin/gyms/${gymId}`);
  return { ok: true, id: gymId };
}

// ── Gym users ────────────────────────────────────────────────────────────────

const addUserSchema = z.object({
  gymId: z.string().min(1),
  username: z.string().trim().min(1, "Username is required"),
  fullName: z.string().trim().min(1, "Name is required"),
  role: z.enum(ROLES),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type AddGymUserInput = z.infer<typeof addUserSchema>;

export async function addGymUser(input: AddGymUserInput): Promise<ActionResult> {
  const { admin } = await getPlatformAdmin();
  const parsed = addUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { data: gym } = await admin.from("gyms").select("slug").eq("id", v.gymId).maybeSingle();
  if (!gym) return { ok: false, error: "Gym not found." };
  const slug = (gym as { slug: string }).slug;

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: staffEmail(v.username, slug), password: v.password, email_confirm: true,
  });
  if (authErr || !created.user) return { ok: false, error: authErr?.message ?? "Failed to create the account." };
  const userId = created.user.id;

  const elevated = v.role === "owner" || v.role === "admin";
  const { error: profErr } = await admin.from("profiles").upsert(
    {
      id: userId, gym_id: v.gymId, role: v.role,
      username: v.username.trim(), full_name: v.fullName.trim(),
      permissions: elevated ? FULL_PERMISSIONS : {}, is_active: true, is_archived: false,
    },
    { onConflict: "id" }
  );
  if (profErr) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: profErr.code === "23505" ? "A user with this username already exists." : profErr.message };
  }

  revalidatePath(`/admin/gyms/${v.gymId}`);
  return { ok: true, id: userId };
}

export async function resetGymUserPassword(userId: string, password: string): Promise<ActionResult> {
  const { admin } = await getPlatformAdmin();
  if (!password || password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  // Confirm the target is a real profile before touching the auth account.
  const { data: prof } = await admin.from("profiles").select("gym_id").eq("id", userId).maybeSingle();
  if (!prof) return { ok: false, error: "User not found." };

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: userId };
}

export async function setGymUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const { admin } = await getPlatformAdmin();
  const { data: prof } = await admin.from("profiles").select("gym_id").eq("id", userId).maybeSingle();
  if (!prof) return { ok: false, error: "User not found." };
  const gymId = (prof as { gym_id: string }).gym_id;

  const { error } = await admin
    .from("profiles")
    .update({ is_active: active, is_archived: !active })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/gyms/${gymId}`);
  return { ok: true, id: userId };
}
