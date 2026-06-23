/**
 * Wipe ALL data for the "captin" test gym, then re-provision an empty one with
 * the same login. Deleting the gym row cascades (every gym-scoped table has
 * `gym_id … on delete cascade`), so this clears clients, classes, sessions,
 * enrolments, finance, the staff profile — everything — in one shot. The auth
 * user is kept and re-linked to a fresh, empty gym.
 *
 *   node --env-file=.env.local scripts/wipe-captin.mjs
 *
 * Login afterwards →  Gym Code: captin · Username: captin · Password: ca2023
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("✖ Missing env (run with --env-file=.env.local)");
  process.exit(1);
}

const SLUG = "captin";
const USERNAME = "captin";
const PASSWORD = "ca2023";
const EMAIL = `${USERNAME}@${SLUG}.velofit`; // matches STAFF_EMAIL_DOMAIN in src/lib/auth.ts

const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// 1) Delete the gym → ON DELETE CASCADE wipes every gym-scoped table (incl. the profile).
{
  const { data: gym, error } = await admin.from("gyms").select("id").eq("slug", SLUG).maybeSingle();
  if (error) throw error;
  if (gym) {
    const { error: delErr } = await admin.from("gyms").delete().eq("id", gym.id);
    if (delErr) throw delErr;
    console.log(`• wiped gym '${SLUG}' and all its data (cascade)`);
  } else {
    console.log(`• gym '${SLUG}' didn't exist — creating fresh`);
  }
}

// 2) Recreate an empty gym.
const { data: gym, error: insErr } = await admin
  .from("gyms")
  .insert({ name: "Captin", slug: SLUG })
  .select("id")
  .single();
if (insErr) throw insErr;
const gymId = gym.id;
console.log(`• fresh gym '${SLUG}' created → ${gymId}`);

// 3) Reuse the existing auth user (reset password), or create it.
let userId;
{
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list?.users?.find((u) => u.email === EMAIL);
  if (found) {
    userId = found.id;
    await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
    console.log(`• auth user ${EMAIL} reused → password reset (${userId})`);
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = created.user.id;
    console.log(`• auth user ${EMAIL} created → ${userId}`);
  }
}

// 4) Owner profile linked to the fresh gym (full permissions for testing).
{
  const permissions = {
    classesManagement: true, trainer: true, secretary: true, addUpdate: true,
    delete: true, memberApplication: true, financeReports: true, reports: true,
  };
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId, gym_id: gymId, role: "owner", full_name: "Captin", username: USERNAME,
      first_name: "Captin", last_name: "Teacher", phone: "", hourly_rate: 0,
      permissions, is_active: true, is_archived: false,
    },
    { onConflict: "id" }
  );
  if (error) throw error;
  console.log(`• owner profile linked to the fresh gym`);
}

console.log("\n✅ captin wiped & re-provisioned empty. Login →  Gym Code: captin · Username: captin · Password: ca2023");
