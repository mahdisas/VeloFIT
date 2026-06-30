import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { listTrainerOptions } from "@/lib/trainers-server";
import { type CalendarSession, type CalendarSessionMap } from "@/lib/calendar";
import { type ClassKind } from "@/lib/class-kinds";
import { type Group, type GroupClassOption } from "@/lib/groups";
import { type ClassSettings } from "@/lib/class-settings";
import {
  emptyWeek,
  isoDowToUiDay,
  type ClassItem,
  type IdName,
  type WeeklyHours,
} from "@/lib/classes";

/**
 * Server-only data access for the Classes Table screen. Kept apart from
 * lib/classes.ts (client-safe types + the still-mock fetchers that back other,
 * not-yet-migrated screens) so importing a type never drags the cookie-scoped
 * server client into the browser bundle.
 *
 * Every query runs through the cookie-scoped server client, so RLS restricts
 * rows to the signed-in staff member's gym; the explicit gym_id filter is
 * defense-in-depth and documents intent.
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type ClassesTableData = {
  classes: ClassItem[];
  trainers: IdName[];
  classKinds: IdName[];
  locations: IdName[];
  groups: IdName[];
};

/** One auth gate, then everything the Classes Table page renders. */
export async function getClassesTableData(): Promise<ClassesTableData> {
  const { supabase, profile } = await getAuthedProfile();
  const gymId = profile.gymId;

  const [classes, trainers, classKinds, locations, groups] = await Promise.all([
    getClasses(supabase, gymId),
    getTrainerOptions(supabase, gymId),
    getClassKindOptions(supabase, gymId),
    getLocationOptions(supabase, gymId),
    getGroupOptions(supabase, gymId),
  ]);

  return { classes, trainers, classKinds, locations, groups };
}

// ── Relation pickers (the wizard's dropdowns) ────────────────────────────────

/** Active trainers for the Trainer picker — real staff (role 'trainer') bridged
 * into the trainers table. Shared with Workout Plans via listTrainerOptions. */
async function getTrainerOptions(supabase: ServerSupabase, gymId: string): Promise<IdName[]> {
  return listTrainerOptions(supabase, gymId);
}

/** Active class kinds for the Class Kind picker (kind_id is required on insert). */
async function getClassKindOptions(supabase: ServerSupabase, gymId: string): Promise<IdName[]> {
  const { data, error } = await supabase
    .from("class_kinds")
    .select("id, name")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Failed to load class kinds: ${error.message}`);
  return (data ?? []) as IdName[];
}

/** Locations (Settings · Locations) for the Location picker. */
async function getLocationOptions(supabase: ServerSupabase, gymId: string): Promise<IdName[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name")
    .eq("gym_id", gymId)
    .order("name");

  if (error) throw new Error(`Failed to load locations: ${error.message}`);
  return (data ?? []) as IdName[];
}

/** Active groups for the Groups multi-select. */
async function getGroupOptions(supabase: ServerSupabase, gymId: string): Promise<IdName[]> {
  const { data, error } = await supabase
    .from("class_groups")
    .select("id, name")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Failed to load groups: ${error.message}`);
  return (data ?? []) as IdName[];
}

// ── Classes list (parent + children → the UI's ClassItem) ────────────────────

type ClassRow = {
  id: string;
  name: string | null;
  description: string | null;
  is_free: boolean;
  notify_trainer: boolean;
  trainer_id: string | null;
  hourly_rate: number;
  kind_id: string | null;
  location_id: string | null;
  color: string | null;
  enroll_before_hours: number | null;
  close_registration_hours: number | null;
  cancel_before_hours: number | null;
  allow_late_cancellation: boolean;
  waiting_list_by_default: boolean;
  show_enroll_list: boolean;
  show_max_participants: boolean;
  allow_waiting_list: boolean;
  starts_on: string | null;
  ends_on: string | null;
  min_participants: number;
  max_participants: number | null;
  cancel_if_below_min: boolean;
  is_active: boolean;
  slots: { day_of_week: number; start_time: string; end_time: string }[] | null;
  equipments: { id: string; name: string; quantity: number }[] | null;
  groups: { group_id: string }[] | null;
};

/** Recurring class templates with their weekly slots, equipment + group links. */
async function getClasses(supabase: ServerSupabase, gymId: string): Promise<ClassItem[]> {
  const { data, error } = await supabase
    .from("classes")
    .select(
      `id, name, description, is_free, notify_trainer, trainer_id, hourly_rate, kind_id, location_id, color,
       enroll_before_hours, close_registration_hours, cancel_before_hours,
       allow_late_cancellation, waiting_list_by_default, show_enroll_list, show_max_participants, allow_waiting_list,
       starts_on, ends_on, min_participants, max_participants, cancel_if_below_min, is_active,
       slots:class_time_slots(day_of_week, start_time, end_time),
       equipments:class_equipments(id, name, quantity),
       groups:class_group_classes(group_id)`
    )
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load classes: ${error.message}`);

  return ((data ?? []) as unknown as ClassRow[]).map((r) => {
    const weeklyHours: WeeklyHours = emptyWeek();
    for (const s of r.slots ?? []) {
      weeklyHours[isoDowToUiDay(s.day_of_week)].push({
        from: s.start_time.slice(0, 5),
        to: s.end_time.slice(0, 5),
      });
    }

    return {
      id: r.id,
      name: r.name ?? "",
      groupIds: (r.groups ?? []).map((g) => g.group_id),
      description: r.description ?? "",
      isFree: r.is_free,
      notifyTrainer: r.notify_trainer,
      trainerId: r.trainer_id,
      hourlyRate: Number(r.hourly_rate),
      classKindId: r.kind_id,
      location: r.location_id,
      color: r.color ?? "#ec1c79",
      enrollBeforeHours: r.enroll_before_hours ?? 0,
      closeRegistrationHours: r.close_registration_hours ?? 0,
      cancelBeforeHours: r.cancel_before_hours,
      allowLateCancellation: r.allow_late_cancellation,
      waitingListByDefault: r.waiting_list_by_default,
      showEnrollList: r.show_enroll_list,
      showMaxParticipants: r.show_max_participants,
      allowWaitingList: r.allow_waiting_list,
      equipments: (r.equipments ?? []).map((e) => ({ id: e.id, name: e.name, quantity: e.quantity })),
      startDate: r.starts_on,
      expireDate: r.ends_on,
      minParticipants: r.min_participants,
      maxParticipants: r.max_participants ?? 0, // null (no cap) → 0 in the UI input
      cancelIfBelowMin: r.cancel_if_below_min,
      weeklyHours,
      isActive: r.is_active,
    } satisfies ClassItem;
  });
}

// =============================================================================
// Calendar — concrete dated sessions for the scheduling grid.
//
// The deployed `calendar_sessions` view resolves name/color/trainer + the live
// enrolled count, but does NOT expose kind_id / class_id / location — which the
// grid's Class-Kind filter and detail dialog need. So we read the underlying
// class_sessions (+ joins) under the same RLS and resolve those fields here.
// (00001_initial_schema.sql ships an enriched view def for future consumers.)
// =============================================================================

type CalendarSessionRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  capacity: number;
  trainer_id: string | null;
  notes: string | null;
  class: {
    id: string;
    name: string | null;
    color: string | null;
    kind_id: string;
    trainer_id: string | null;
    location_id: string | null;
    show_enroll_list: boolean;
    show_max_participants: boolean;
    kind: { name: string; color: string } | null;
  } | null;
};

const DEFAULT_SESSION_CAPACITY = 20;

/** ISO day-of-week (1=Mon … 7=Sun) for a "YYYY-MM-DD" date. */
function isoDow(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const js = new Date(y, m - 1, d).getDay(); // 0=Sun … 6=Sat
  return js === 0 ? 7 : js;
}

/** Every "YYYY-MM-DD" in [start, end], inclusive. */
function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const cur = new Date(ys, ms - 1, ds);
  const last = new Date(ye, me - 1, de);
  while (cur <= last) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

type SlotClassRow = {
  id: string;
  max_participants: number | null;
  starts_on: string | null;
  ends_on: string | null;
  slots: { day_of_week: number; start_time: string; end_time: string }[] | null;
};

/**
 * Project each active class's weekly hours (class_time_slots) onto concrete
 * class_sessions for the visible [start, end] window — generated on demand, so a
 * recurring class shows on every matching weekday forever (even in 2100) without
 * ever pre-seeding thousands of rows. Idempotent: `ignoreDuplicates` means an
 * existing session (a per-date edit, a cancellation, one with enrollments) is
 * never overwritten — it always wins over the generated default.
 *
 * This is also what makes a weekly-hours edit in the Classes Table "project"
 * onto the calendar: change the slots and the next view regenerates from them.
 */
export async function ensureSessionsForRange(
  supabase: ServerSupabase,
  gymId: string,
  start: string,
  end: string
): Promise<void> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, max_participants, starts_on, ends_on, slots:class_time_slots(day_of_week, start_time, end_time)")
    .eq("gym_id", gymId)
    .eq("is_active", true);
  if (error || !data) return;

  // Memoize the dates per weekday across the window.
  const datesByDow = new Map<number, string[]>();
  const datesFor = (dow: number): string[] => {
    let cached = datesByDow.get(dow);
    if (!cached) {
      cached = datesInRange(start, end).filter((d) => isoDow(d) === dow);
      datesByDow.set(dow, cached);
    }
    return cached;
  };

  const rows: {
    gym_id: string;
    class_id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    capacity: number;
    status: "scheduled";
  }[] = [];

  for (const c of data as unknown as SlotClassRow[]) {
    const capacity = c.max_participants ?? DEFAULT_SESSION_CAPACITY;
    const lower = c.starts_on && c.starts_on > start ? c.starts_on : start;
    for (const slot of c.slots ?? []) {
      for (const date of datesFor(slot.day_of_week)) {
        if (date < lower) continue;
        if (c.ends_on && date > c.ends_on) continue;
        rows.push({
          gym_id: gymId,
          class_id: c.id,
          session_date: date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          capacity,
          status: "scheduled",
        });
      }
    }
  }
  if (rows.length === 0) return;

  await supabase
    .from("class_sessions")
    .upsert(rows, { onConflict: "class_id,session_date,start_time", ignoreDuplicates: true });
}

/** Sessions in [start, end] (inclusive, "YYYY-MM-DD"), grouped by session_date. */
export async function fetchCalendarSessions(
  supabase: ServerSupabase,
  gymId: string,
  start: string,
  end: string
): Promise<CalendarSessionMap> {
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      `id, session_date, start_time, end_time, status, capacity, trainer_id, notes,
       class:classes(id, name, color, kind_id, trainer_id, location_id, show_enroll_list, show_max_participants, kind:class_kinds(name, color))`
    )
    .eq("gym_id", gymId)
    .gte("session_date", start)
    .lte("session_date", end)
    .order("start_time");

  if (error) throw new Error(`Failed to load calendar sessions: ${error.message}`);
  const rows = (data ?? []) as unknown as CalendarSessionRow[];
  if (rows.length === 0) return {};

  // Live enrolled count = enrollments in (booked, attended), mirroring the view.
  const ids = rows.map((r) => r.id);
  const { data: enr, error: enrError } = await supabase
    .from("class_enrollments")
    .select("session_id")
    .eq("gym_id", gymId)
    .in("session_id", ids)
    .in("status", ["booked", "attended"]);
  if (enrError) throw new Error(`Failed to load enrollments: ${enrError.message}`);

  const enrolled = new Map<string, number>();
  for (const e of (enr ?? []) as { session_id: string }[]) {
    enrolled.set(e.session_id, (enrolled.get(e.session_id) ?? 0) + 1);
  }

  // Resolve trainer names once (per-session substitute wins over the class default).
  const { data: tr, error: trError } = await supabase
    .from("trainers")
    .select("id, full_name")
    .eq("gym_id", gymId);
  if (trError) throw new Error(`Failed to load trainers: ${trError.message}`);
  const trainerName = new Map(((tr ?? []) as { id: string; full_name: string }[]).map((t) => [t.id, t.full_name]));

  const map: CalendarSessionMap = {};
  for (const r of rows) {
    const c = r.class;
    const trainerId = r.trainer_id ?? c?.trainer_id ?? null;
    const session: CalendarSession = {
      id: r.id,
      classId: c?.id ?? "",
      name: c?.name ?? c?.kind?.name ?? "—",
      trainer: (trainerId && trainerName.get(trainerId)) || "",
      trainerId,
      locationId: c?.location_id ?? null,
      color: c?.color ?? c?.kind?.color ?? "#ec1c79",
      from: r.start_time.slice(0, 5),
      to: r.end_time.slice(0, 5),
      enrolled: enrolled.get(r.id) ?? 0,
      capacity: r.capacity,
      kindId: c?.kind_id ?? "",
      canceled: r.status === "canceled",
      notes: r.notes ?? "",
      showEnrollList: c?.show_enroll_list ?? false,
      showMaxParticipants: c?.show_max_participants ?? false,
    };
    (map[r.session_date] ??= []).push(session);
  }
  return map;
}

/** Active classes as "Class name - Trainer" options for the quick-add picker. */
async function getClassPickerOptions(supabase: ServerSupabase, gymId: string): Promise<IdName[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, trainer_id, kind:class_kinds(name)")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load class picker options: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string | null;
    trainer_id: string | null;
    kind: { name: string } | null;
  }[];
  if (rows.length === 0) return [];

  const { data: tr } = await supabase.from("trainers").select("id, full_name").eq("gym_id", gymId);
  const trainerName = new Map(((tr ?? []) as { id: string; full_name: string }[]).map((t) => [t.id, t.full_name]));

  return rows.map((c) => {
    const label = c.name ?? c.kind?.name ?? "—";
    const trainer = c.trainer_id ? trainerName.get(c.trainer_id) : "";
    return { id: c.id, name: trainer ? `${label} - ${trainer}` : label };
  });
}

/** Sessions for a date window — used by the client's on-navigation refetch. */
export async function getCalendarSessions(start: string, end: string): Promise<CalendarSessionMap> {
  const { supabase, profile } = await getAuthedProfile();
  return getCalendarSessionsFor(supabase, profile.gymId, start, end);
}

/** Same as getCalendarSessions but for an explicit client + gym (member viewer). */
export async function getCalendarSessionsFor(
  supabase: ServerSupabase,
  gymId: string,
  start: string,
  end: string
): Promise<CalendarSessionMap> {
  await ensureSessionsForRange(supabase, gymId, start, end);
  return fetchCalendarSessions(supabase, gymId, start, end);
}

export type CalendarPageData = {
  initialSessions: CalendarSessionMap;
  trainers: IdName[];
  classKinds: IdName[];
  locations: IdName[];
  groups: IdName[];
  classPickerOptions: IdName[];
};

/** One auth gate, then everything the Calendar page renders for its initial window. */
export async function getCalendarPageData(start: string, end: string): Promise<CalendarPageData> {
  const { supabase, profile } = await getAuthedProfile();
  const gymId = profile.gymId;

  // Project recurring weekly hours onto this window before reading it.
  await ensureSessionsForRange(supabase, gymId, start, end);

  const [initialSessions, trainers, classKinds, locations, groups, classPickerOptions] = await Promise.all([
    fetchCalendarSessions(supabase, gymId, start, end),
    getTrainerOptions(supabase, gymId),
    getClassKindOptions(supabase, gymId),
    getLocationOptions(supabase, gymId),
    getGroupOptions(supabase, gymId),
    getClassPickerOptions(supabase, gymId),
  ]);

  return { initialSessions, trainers, classKinds, locations, groups, classPickerOptions };
}

// =============================================================================
// Classes Kinds (catalog) — full rows for the Classes Kinds screen.
// =============================================================================
export async function getClassKinds(): Promise<ClassKind[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("class_kinds")
    .select("id, name, description, min_participants, max_participants, image_url, is_active")
    .eq("gym_id", profile.gymId)
    .order("name");

  if (error) throw new Error(`Failed to load class kinds: ${error.message}`);

  return ((data ?? []) as ClassKindRow[]).map((k) => ({
    id: k.id,
    name: k.name,
    description: k.description ?? "",
    minParticipants: k.min_participants,
    maxParticipants: k.max_participants ?? 0,
    imageUrl: k.image_url,
    isActive: k.is_active,
  }));
}
type ClassKindRow = {
  id: string;
  name: string;
  description: string | null;
  min_participants: number;
  max_participants: number | null;
  image_url: string | null;
  is_active: boolean;
};

// =============================================================================
// Groups Management — tiered price cards bundling classes.
// =============================================================================
type GroupRow = {
  id: string;
  name: string;
  notes: string | null;
  price_1m: number;
  price_2m: number;
  price_3m: number;
  price_4m: number;
  price_6m: number;
  price_yearly: number;
  is_active: boolean;
  links: { class_id: string }[] | null;
};

export async function getGroupsPageData(): Promise<{ groups: Group[]; classOptions: GroupClassOption[] }> {
  const { supabase, profile } = await getAuthedProfile();
  const gymId = profile.gymId;

  const [groupsRes, optionsRes] = await Promise.all([
    supabase
      .from("class_groups")
      .select(
        "id, name, notes, price_1m, price_2m, price_3m, price_4m, price_6m, price_yearly, is_active, links:class_group_classes(class_id)"
      )
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false }),
    supabase
      .from("classes")
      .select("id, name, kind:class_kinds(name)")
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  if (groupsRes.error) throw new Error(`Failed to load groups: ${groupsRes.error.message}`);
  if (optionsRes.error) throw new Error(`Failed to load classes: ${optionsRes.error.message}`);

  const groups: Group[] = ((groupsRes.data ?? []) as unknown as GroupRow[]).map((g) => ({
    id: g.id,
    name: g.name,
    classIds: (g.links ?? []).map((l) => l.class_id),
    price1m: Number(g.price_1m),
    price2m: Number(g.price_2m),
    price3m: Number(g.price_3m),
    price4m: Number(g.price_4m),
    price6m: Number(g.price_6m),
    priceYearly: Number(g.price_yearly),
    notes: g.notes ?? "",
    isActive: g.is_active,
  }));

  const classOptions: GroupClassOption[] = (
    (optionsRes.data ?? []) as unknown as { id: string; name: string | null; kind: { name: string } | null }[]
  ).map((c) => ({ id: c.id, name: c.name ?? c.kind?.name ?? "—" }));

  return { groups, classOptions };
}

// =============================================================================
// Classes Settings — stored on gyms.settings under the `classes` key.
// =============================================================================
export const DEFAULT_CLASS_SETTINGS: ClassSettings = {
  convertWaitingToApproved: true,
  notifyOnCancellation: true,
  reminderMinutesBefore: 0,
  showClassesEveryWeek: false,
  scheduleNextDays: 30,
  applyEnrollmentLimitAcrossSubscriptions: false,
  blockClientsForAbsences: false,
};

export async function getClassSettings(): Promise<ClassSettings> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("gyms")
    .select("settings")
    .eq("id", profile.gymId)
    .single();

  if (error) throw new Error(`Failed to load class settings: ${error.message}`);

  const stored = ((data?.settings as { classes?: Partial<ClassSettings> } | null)?.classes) ?? {};
  return { ...DEFAULT_CLASS_SETTINGS, ...stored };
}
