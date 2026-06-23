"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";
import { uiDayToIsoDow, type ClassItem } from "@/lib/classes";
import type { createClient } from "@/lib/supabase/server";

/**
 * Classes Table write operations (the "Class Wizard"). Every action:
 *   - runs through getAuthedProfile() (auth gate; redirects if unauthenticated),
 *   - derives gym_id from the AUTHED PROFILE — never from the client payload,
 *   - validates the whole wizard payload with Zod (schema-aligned), and
 *   - writes the parent `classes` row plus its child rows (weekly time slots,
 *     equipment, group links).
 * RLS independently scopes writes to the gym; explicit gym_id filters are
 * defense-in-depth.
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

/** The wizard's full form payload (everything except the server-owned id/active flag). */
type ClassFormValues = Omit<ClassItem, "id" | "isActive">;

// ── Validation ───────────────────────────────────────────────────────────────

const TIME_RE = /^\d{2}:\d{2}$/;

const timeSlotSchema = z.object({
  from: z.string().regex(TIME_RE, "Invalid time"),
  to: z.string().regex(TIME_RE, "Invalid time"),
});

const equipmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().min(1),
});

const classFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    groupIds: z.array(z.string()),
    description: z.string(),
    isFree: z.boolean(),
    notifyTrainer: z.boolean(),
    trainerId: z.string().nullable(),
    hourlyRate: z.number().min(0),
    // kind_id is NOT NULL in the schema → required. null/"" surfaces a clear message.
    classKindId: z.preprocess((v) => v ?? "", z.string().min(1, "Select a class kind")),
    location: z.string().nullable(),
    color: z.string(),
    enrollBeforeHours: z.number().int().min(0),
    closeRegistrationHours: z.number().int().min(0),
    cancelBeforeHours: z.number().int().min(0).nullable(),
    allowLateCancellation: z.boolean(),
    waitingListByDefault: z.boolean(),
    showEnrollList: z.boolean(),
    showMaxParticipants: z.boolean(),
    allowWaitingList: z.boolean(),
    equipments: z.array(equipmentSchema),
    startDate: z.string().nullable(),
    expireDate: z.string().nullable(),
    minParticipants: z.number().int().min(0),
    maxParticipants: z.number().int().min(0),
    cancelIfBelowMin: z.boolean(),
    weeklyHours: z.array(z.array(timeSlotSchema)).length(7),
  })
  // Mirrors the DB check: max_participants is null OR >= min_participants
  // (0 in the UI means "no cap" → stored as null, so it's always allowed).
  .refine((v) => v.maxParticipants === 0 || v.maxParticipants >= v.minParticipants, {
    message: "Max participants must be ≥ min participants",
    path: ["maxParticipants"],
  })
  .refine((v) => !v.expireDate || !v.startDate || v.expireDate >= v.startDate, {
    message: "Expire date must be on or after the start date",
    path: ["expireDate"],
  });

type ParsedClass = z.infer<typeof classFormSchema>;

// "" → null for nullable text columns.
const nullable = (v: string) => {
  const t = v.trim();
  return t === "" ? null : t;
};

/** The `classes` column map (no gym_id; the caller owns tenant scoping). */
function buildClassRow(v: ParsedClass) {
  return {
    kind_id: v.classKindId,
    trainer_id: v.trainerId,
    location_id: v.location,
    name: v.name.trim(),
    color: v.color,
    description: nullable(v.description),
    is_free: v.isFree,
    notify_trainer: v.notifyTrainer,
    hourly_rate: v.hourlyRate,
    min_participants: v.minParticipants,
    max_participants: v.maxParticipants > 0 ? v.maxParticipants : null, // 0 → no cap
    enroll_before_hours: v.enrollBeforeHours,
    close_registration_hours: v.closeRegistrationHours,
    cancel_before_hours: v.cancelBeforeHours,
    allow_late_cancellation: v.allowLateCancellation,
    waiting_list_by_default: v.waitingListByDefault,
    show_enroll_list: v.showEnrollList,
    show_max_participants: v.showMaxParticipants,
    allow_waiting_list: v.allowWaitingList,
    cancel_if_below_min: v.cancelIfBelowMin,
    // starts_on is NOT NULL with a default — omit when blank so the default wins.
    ...(v.startDate ? { starts_on: v.startDate } : {}),
    ends_on: v.expireDate,
  };
}

/**
 * Insert the child rows for a class. Returns an error string on failure (the
 * caller rolls back / surfaces it). The Supabase JS client can't span a real
 * transaction, so create() compensates by deleting the orphan parent.
 */
async function insertChildren(
  supabase: ServerSupabase,
  gymId: string,
  classId: string,
  v: ParsedClass
): Promise<string | null> {
  // Weekly time slots — flatten the 7-day grid, mapping UI day → ISO day_of_week.
  const slots = v.weeklyHours.flatMap((daySlots, uiDay) =>
    daySlots
      .filter((s) => s.from && s.to)
      .map((s) => ({
        gym_id: gymId,
        class_id: classId,
        day_of_week: uiDayToIsoDow(uiDay),
        start_time: s.from,
        end_time: s.to,
      }))
  );
  if (slots.length) {
    const { error } = await supabase.from("class_time_slots").insert(slots);
    if (error) return `Failed to save schedule: ${error.message}`;
  }

  const equipments = v.equipments
    .filter((e) => e.name.trim())
    .map((e) => ({ gym_id: gymId, class_id: classId, name: e.name.trim(), quantity: e.quantity }));
  if (equipments.length) {
    const { error } = await supabase.from("class_equipments").insert(equipments);
    if (error) return `Failed to save equipment: ${error.message}`;
  }

  const links = v.groupIds.map((groupId) => ({ gym_id: gymId, group_id: groupId, class_id: classId }));
  if (links.length) {
    const { error } = await supabase.from("class_group_classes").insert(links);
    if (error) return `Failed to link groups: ${error.message}`;
  }

  return null;
}

// ── Create ───────────────────────────────────────────────────────────────────
export async function createClass(input: ClassFormValues): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = classFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { data, error } = await supabase
    .from("classes")
    .insert({ gym_id: profile.gymId, ...buildClassRow(v) }) // ← tenant from the session, not the UI
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  const classId = data.id as string;

  const childError = await insertChildren(supabase, profile.gymId, classId, v);
  if (childError) {
    // Roll back the parent so we never leave a class with no schedule.
    await supabase.from("classes").delete().eq("id", classId).eq("gym_id", profile.gymId);
    return { ok: false, error: childError };
  }

  revalidatePath("/classes/table");
  return { ok: true, id: classId };
}

// ── Update (replace children) ─────────────────────────────────────────────────
export async function updateClass(id: string, input: ClassFormValues): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = classFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { error } = await supabase
    .from("classes")
    .update(buildClassRow(v))
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  // Replace the child rows wholesale (simplest correct sync for the wizard).
  for (const table of ["class_time_slots", "class_equipments", "class_group_classes"] as const) {
    await supabase.from(table).delete().eq("class_id", id).eq("gym_id", profile.gymId);
  }
  const childError = await insertChildren(supabase, profile.gymId, id, v);
  if (childError) return { ok: false, error: childError };

  // Re-project onto the calendar: drop future auto-generated sessions that have
  // no enrollments so they regenerate from the NEW weekly hours on the next view.
  // Sessions with booked/attended clients are left intact (managed per-date).
  await clearEmptyFutureSessions(supabase, profile.gymId, id);

  revalidatePath("/classes/table");
  revalidatePath("/classes/calendar");
  return { ok: true, id };
}

/** Today's date as "YYYY-MM-DD" (local). */
function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Delete a class's upcoming scheduled sessions that nobody is enrolled in. */
async function clearEmptyFutureSessions(supabase: ServerSupabase, gymId: string, classId: string): Promise<void> {
  const { data } = await supabase
    .from("class_sessions")
    .select("id, enrollments:class_enrollments(id)")
    .eq("gym_id", gymId)
    .eq("class_id", classId)
    .eq("status", "scheduled")
    .gte("session_date", isoToday());
  const emptyIds = ((data ?? []) as { id: string; enrollments: { id: string }[] | null }[])
    .filter((s) => (s.enrollments?.length ?? 0) === 0)
    .map((s) => s.id);
  if (emptyIds.length) {
    await supabase.from("class_sessions").delete().in("id", emptyIds).eq("gym_id", gymId);
  }
}

// ── Soft delete / restore (Active ↔ Inactive tabs) ────────────────────────────
export async function deleteClass(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase
    .from("classes")
    .update({ is_active: false })
    .eq("id", id)
    .eq("gym_id", profile.gymId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/classes/table");
  return { ok: true, id };
}

export async function restoreClass(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase
    .from("classes")
    .update({ is_active: true })
    .eq("id", id)
    .eq("gym_id", profile.gymId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/classes/table");
  return { ok: true, id };
}
