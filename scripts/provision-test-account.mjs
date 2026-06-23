/**
 * One-off: provision a test gym + owner staff account (for the teacher demo).
 * Idempotent — safe to re-run (reuses the gym, resets the password if the user
 * already exists). Uses the Supabase service role (admin) so it can create the
 * auth user + bypass RLS for the gym/profile rows.
 *
 *   node --env-file=.env.local scripts/provision-test-account.mjs
 *
 * Login afterwards →  Gym Code: captin · Username: captin · Password: ca2023
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("✖ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)");
  process.exit(1);
}

const SLUG = "captin";
const USERNAME = "captin";
const PASSWORD = "ca2023";
const EMAIL = `${USERNAME}@${SLUG}.velofit`; // matches STAFF_EMAIL_DOMAIN in src/lib/auth.ts

const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// 1) Gym — reuse if the slug already exists.
let gymId;
{
  const { data: existing, error } = await admin.from("gyms").select("id").eq("slug", SLUG).maybeSingle();
  if (error) throw error;
  if (existing) {
    gymId = existing.id;
    console.log(`• gym '${SLUG}' already exists → ${gymId}`);
  } else {
    const { data, error: insErr } = await admin.from("gyms").insert({ name: "Captin", slug: SLUG }).select("id").single();
    if (insErr) throw insErr;
    gymId = data.id;
    console.log(`• gym '${SLUG}' created → ${gymId}`);
  }
}

// 2) Auth user — create, or reset the password if it already exists.
let userId;
{
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list?.users?.find((u) => u.email === EMAIL);
    if (!found) throw error;
    userId = found.id;
    await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
    console.log(`• auth user ${EMAIL} already existed → password reset (${userId})`);
  } else {
    userId = created.user.id;
    console.log(`• auth user ${EMAIL} created → ${userId}`);
  }
}

// 3) Profile — owner role + all permission flags so the teacher can test everything.
{
  const permissions = {
    classesManagement: true, trainer: true, secretary: true, addUpdate: true,
    delete: true, memberApplication: true, financeReports: true, reports: true,
  };
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      gym_id: gymId,
      role: "owner",
      full_name: "Captin",
      username: USERNAME,
      first_name: "Captin",
      last_name: "Teacher",
      phone: "",
      hourly_rate: 0,
      permissions,
      is_active: true,
      is_archived: false,
    },
    { onConflict: "id" }
  );
  if (error) throw error;
  console.log(`• profile upserted (owner) for ${userId}`);
}

console.log("\n✅ Provisioned. Login →  Gym Code: captin · Username: captin · Password: ca2023");
