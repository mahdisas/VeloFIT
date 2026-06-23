/**
 * Demo data for the "captin" test gym: two recurring classes (a daily morning +
 * evening slot) and a few clients, so the mobile veloFIT App's calendar shows
 * classes and the attendance sheet has clients to add. Idempotent — reuses rows
 * by name. Sessions themselves are generated on demand by the app
 * (ensureSessionsForRange) from the weekly slots seeded here.
 *
 *   node --env-file=.env.local scripts/seed-captin-classes.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("✖ Missing env (run with --env-file=.env.local)");
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: gym, error: gymErr } = await admin.from("gyms").select("id").eq("slug", "captin").maybeSingle();
if (gymErr) throw gymErr;
if (!gym) {
  console.error("✖ gym 'captin' not found — run provision-test-account.mjs first");
  process.exit(1);
}
const gymId = gym.id;

/** Reuse a row matched by (gym_id, name) or insert it. */
async function ensure(table, match, insert) {
  const { data: found, error } = await admin
    .from(table)
    .select("id")
    .eq("gym_id", gymId)
    .eq("name", match)
    .maybeSingle();
  if (error) throw error;
  if (found) return found.id;
  const { data, error: insErr } = await admin
    .from(table)
    .insert({ gym_id: gymId, ...insert })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return data.id;
}

// 1) A kind, then two classes.
const kindId = await ensure("class_kinds", "Group Training", {
  name: "Group Training",
  color: "#3b82f6",
  min_participants: 0,
  max_participants: 20,
});

const classes = [
  { name: "Morning HIIT", color: "#3b82f6", from: "08:00", to: "09:00", cap: 12 },
  { name: "Evening Yoga", color: "#ec1c79", from: "18:00", to: "19:00", cap: 15 },
];

for (const c of classes) {
  const classId = await ensure("classes", c.name, {
    kind_id: kindId,
    name: c.name,
    color: c.color,
    max_participants: c.cap,
    is_active: true,
  });

  // A weekly slot for every day of the week → a session on every visible day.
  const { data: existingSlots } = await admin
    .from("class_time_slots")
    .select("id")
    .eq("gym_id", gymId)
    .eq("class_id", classId);
  if (!existingSlots?.length) {
    const slots = Array.from({ length: 7 }, (_, i) => ({
      gym_id: gymId,
      class_id: classId,
      day_of_week: i + 1, // 1=Mon … 7=Sun
      start_time: c.from,
      end_time: c.to,
    }));
    const { error } = await admin.from("class_time_slots").insert(slots);
    if (error) throw error;
  }
  console.log(`• class '${c.name}' ready (${classId})`);
}

// 2) A few clients to add to classes.
for (const name of ["Sara Cohen", "Omar Haddad", "Lena Mizrahi", "David Levi"]) {
  const { data: found } = await admin
    .from("clients")
    .select("id")
    .eq("gym_id", gymId)
    .eq("full_name", name)
    .maybeSingle();
  if (!found) {
    const { error } = await admin.from("clients").insert({ gym_id: gymId, full_name: name, status: "active" });
    if (error) throw error;
    console.log(`• client '${name}' created`);
  } else {
    console.log(`• client '${name}' already exists`);
  }
}

console.log("\n✅ Seeded captin demo classes + clients.");
