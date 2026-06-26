"use server";

import { revalidatePath } from "next/cache";

import { getAuthedProfile } from "@/lib/dal";
import { getCalendarSessions } from "@/lib/classes-server";
import { consumeClassPass } from "@/lib/class-pass-server";
import { type CalendarSessionMap } from "@/lib/calendar";

/**
 * Load the sessions for a date window. Called by the calendar grid when the user
 * navigates to a range that isn't cached yet. Auth + gym scoping happen inside
 * getCalendarSessions (getAuthedProfile + RLS).
 */
export async function loadCalendarSessions(start: string, end: string): Promise<CalendarSessionMap> {
  return getCalendarSessions(start, end);
}

export type QuickAddInput = {
  classId: string;
  date: string; // yyyy-mm-dd
  from: string; // HH:MM
  to: string; // HH:MM
  asSeries: boolean; // repeat on every matching weekday
};

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Schedule a class onto the calendar. One-off → insert a single class_sessions
 * row; series → insert a class_time_slots row for that weekday (so it recurs)
 * and backfill upcoming sessions. RLS-scoped to the caller's gym.
 */
const DEFAULT_QUICK_ADD_CAPACITY = 20;
const SERIES_WEEKS = 8;

/** ISO day_of_week (1=Mon…7=Sun) for a "YYYY-MM-DD" date. */
function isoDayOfWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const js = new Date(y, m - 1, d).getDay(); // 0=Sun…6=Sat
  return js === 0 ? 7 : js;
}

/** `weeks` consecutive weekly dates starting at `startIso` (local calendar). */
function weeklyDates(startIso: string, weeks: number): string[] {
  const [y, m, d] = startIso.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  return Array.from({ length: weeks }, (_, i) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + i * 7);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  });
}

/**
 * Drop a class onto the calendar. One-off → a single class_sessions row; series
 * → also persist a weekly class_time_slot and generate the next 8 weekly
 * sessions. Returns the affected window so the grid can merge it without a reload.
 */
export async function quickAddSession(
  input: QuickAddInput
): Promise<{ ok: true; sessions: CalendarSessionMap } | { ok: false; error: string }> {
  const { supabase, profile } = await getAuthedProfile();

  if (!input.classId) return { ok: false, error: "Please choose a class" };
  if (!input.date) return { ok: false, error: "Please choose a date" };
  if (!input.from || !input.to) return { ok: false, error: "Please set the hours" };
  if (input.to <= input.from) return { ok: false, error: "End hour must be after start hour" };

  // The class must belong to this gym; capacity snapshots its max_participants.
  const { data: cls, error: clsError } = await supabase
    .from("classes")
    .select("id, max_participants")
    .eq("id", input.classId)
    .eq("gym_id", profile.gymId)
    .maybeSingle();
  if (clsError) return { ok: false, error: clsError.message };
  if (!cls) return { ok: false, error: "Class not found in this gym." };
  const capacity = (cls.max_participants as number | null) ?? DEFAULT_QUICK_ADD_CAPACITY;

  if (input.asSeries) {
    // Persist the weekly slot so it shows in the class's Class Hours AND recurs
    // forever on the calendar (ensureSessionsForRange projects from these slots).
    // Skip if an identical slot already exists (avoid duplicate hours).
    const dow = isoDayOfWeek(input.date);
    const { data: existingSlot } = await supabase
      .from("class_time_slots")
      .select("id")
      .eq("gym_id", profile.gymId)
      .eq("class_id", input.classId)
      .eq("day_of_week", dow)
      .eq("start_time", input.from)
      .eq("end_time", input.to)
      .maybeSingle();
    if (!existingSlot) {
      const { error: slotError } = await supabase.from("class_time_slots").insert({
        gym_id: profile.gymId,
        class_id: input.classId,
        day_of_week: dow,
        start_time: input.from,
        end_time: input.to,
      });
      if (slotError) return { ok: false, error: slotError.message };
    }
  }

  const dates = input.asSeries ? weeklyDates(input.date, SERIES_WEEKS) : [input.date];
  const rows = dates.map((session_date) => ({
    gym_id: profile.gymId,
    class_id: input.classId,
    session_date,
    start_time: input.from,
    end_time: input.to,
    capacity,
    status: "scheduled" as const,
  }));

  // Skip any date that already has this class at the same start time.
  const { error: insError } = await supabase
    .from("class_sessions")
    .upsert(rows, { onConflict: "class_id,session_date,start_time", ignoreDuplicates: true });
  if (insError) return { ok: false, error: insError.message };

  revalidatePath("/classes/calendar");
  if (input.asSeries) revalidatePath("/classes/table"); // reflect the new weekly hours in the class data

  const sessions = await getCalendarSessions(input.date, dates[dates.length - 1]);
  return { ok: true, sessions };
}

// =============================================================================
// Enrollments — the session roster (class_enrollments). Every action is gym-
// scoped via getAuthedProfile(); RLS independently restricts rows to the gym.
// =============================================================================

export type RosterStatus = "booked" | "attended" | "no_show" | "canceled" | "waitlisted";

export type RosterMember = {
  enrollmentId: string;
  clientId: string;
  name: string;
  status: RosterStatus;
  note?: string; // per-trainee note (class_enrollments.notes)
};

export type EnrollResult =
  | { success: true; member: RosterMember }
  | { success: false; error: "SESSION_FULL" | "ALREADY_ENROLLED" | "NOT_FOUND" | "ERROR"; message: string };

type RosterRow = { id: string; status: string; notes: string | null; client: { id: string; full_name: string } | null };

/** The session's roster (newest enrollment last), for the detail dialog. */
export async function getSessionRoster(sessionId: string): Promise<RosterMember[]> {
  const { supabase, profile } = await getAuthedProfile();

  const roster = (cols: string) =>
    supabase
      .from("class_enrollments")
      .select(cols)
      .eq("gym_id", profile.gymId)
      .eq("session_id", sessionId)
      .order("created_at");

  // Prefer the note column; fall back if migration 00013 isn't applied yet so a
  // missing column never breaks the (core) roster — the note just won't load.
  let { data, error } = await roster("id, status, notes, client:clients(id, full_name)");
  if (error && /notes/i.test(error.message)) {
    ({ data, error } = await roster("id, status, client:clients(id, full_name)"));
  }
  if (error) throw new Error(`Failed to load roster: ${error.message}`);

  return ((data ?? []) as unknown as RosterRow[]).map((r) => ({
    enrollmentId: r.id,
    clientId: r.client?.id ?? "",
    name: r.client?.full_name ?? "—",
    status: r.status as RosterStatus,
    note: r.notes ?? "",
  }));
}

/** Persist a per-trainee note on an enrollment (the roster's "Notes" button). */
export async function setEnrollmentNote(enrollmentId: string, note: string): Promise<SimpleResult> {
  const { supabase, profile } = await getAuthedProfile();

  const trimmed = note.trim();
  const { error } = await supabase
    .from("class_enrollments")
    .update({ notes: trimmed || null })
    .eq("id", enrollmentId)
    .eq("gym_id", profile.gymId);

  if (error) return { success: false, message: error.message };

  revalidatePath("/classes/calendar");
  return { success: true };
}

/** Up to 8 active clients matching `query` — feeds the "Add a trainee" picker. */
export async function searchEnrollableClients(query: string): Promise<{ id: string; name: string }[]> {
  const { supabase, profile } = await getAuthedProfile();

  let q = supabase
    .from("clients")
    .select("id, full_name")
    .eq("gym_id", profile.gymId)
    .neq("status", "archived")
    .order("full_name")
    .limit(8);

  const trimmed = query.trim();
  if (trimmed) q = q.ilike("full_name", `%${trimmed}%`);

  const { data, error } = await q;
  if (error) throw new Error(`Failed to search clients: ${error.message}`);

  return ((data ?? []) as { id: string; full_name: string }[]).map((c) => ({ id: c.id, name: c.full_name }));
}

/**
 * Enroll a client into a session. The enforce_session_capacity DB trigger
 * row-locks the session and raises a check_violation (SQLSTATE 23514, "… is
 * full") when capacity is reached — we translate that into a friendly
 * SESSION_FULL result instead of leaking the raw error.
 */
export async function enrollClientInSession(sessionId: string, clientId: string): Promise<EnrollResult> {
  const { supabase, profile } = await getAuthedProfile();

  // Defense-in-depth: confirm both rows live in this gym (RLS also enforces it,
  // and the capacity trigger must be able to see the session under the caller's RLS).
  const [sessionRes, clientRes] = await Promise.all([
    supabase.from("class_sessions").select("id").eq("id", sessionId).eq("gym_id", profile.gymId).maybeSingle(),
    supabase.from("clients").select("id, full_name").eq("id", clientId).eq("gym_id", profile.gymId).maybeSingle(),
  ]);
  const client = clientRes.data as { id: string; full_name: string } | null;
  if (!sessionRes.data || !client) {
    return { success: false, error: "NOT_FOUND", message: "Session or client not found in this gym." };
  }

  try {
    const { data, error } = await supabase
      .from("class_enrollments")
      .insert({ gym_id: profile.gymId, session_id: sessionId, client_id: clientId, status: "booked" })
      .select("id")
      .single();

    if (error) {
      // enforce_session_capacity(): errcode check_violation (23514) "… is full".
      if (error.code === "23514" && /is full/i.test(error.message)) {
        return { success: false, error: "SESSION_FULL", message: "This session has reached its maximum capacity." };
      }
      // unique (session_id, client_id) → already on the roster.
      if (error.code === "23505") {
        return { success: false, error: "ALREADY_ENROLLED", message: `${client.full_name} is already enrolled in this session.` };
      }
      return { success: false, error: "ERROR", message: error.message };
    }

    revalidatePath("/classes/calendar");
    return {
      success: true,
      member: { enrollmentId: data.id as string, clientId: client.id, name: client.full_name, status: "booked" },
    };
  } catch (e) {
    return { success: false, error: "ERROR", message: e instanceof Error ? e.message : "Failed to enroll client." };
  }
}

/**
 * Move an existing enrollment to a new status — powers Cancel (→ canceled) and
 * Approve/Promote (→ booked). Re-booking also passes through the capacity trigger,
 * so it can return SESSION_FULL too.
 */
export async function setEnrollmentStatus(enrollmentId: string, status: RosterStatus): Promise<EnrollResult> {
  const { supabase, profile } = await getAuthedProfile();

  try {
    const { data, error } = await supabase
      .from("class_enrollments")
      .update({ status })
      .eq("id", enrollmentId)
      .eq("gym_id", profile.gymId)
      .select("id, status, client:clients(id, full_name)")
      .single();

    if (error) {
      if (error.code === "23514" && /is full/i.test(error.message)) {
        return { success: false, error: "SESSION_FULL", message: "This session has reached its maximum capacity." };
      }
      return { success: false, error: "ERROR", message: error.message };
    }

    revalidatePath("/classes/calendar");
    const row = data as unknown as RosterRow;
    return {
      success: true,
      member: {
        enrollmentId: row.id,
        clientId: row.client?.id ?? "",
        name: row.client?.full_name ?? "—",
        status: row.status as RosterStatus,
      },
    };
  } catch (e) {
    return { success: false, error: "ERROR", message: e instanceof Error ? e.message : "Failed to update enrollment." };
  }
}

export type SimpleResult = { success: true } | { success: false; message: string };

/**
 * Mark an enrolled client as attended / not attended — toggles a single
 * enrollment between 'attended' and 'booked'. Both count toward capacity, so
 * the enforce_session_capacity trigger (which excludes the row itself) never
 * blocks this.
 *
 * Marking attended also logs a door entrance (an `attendances` row stamped at
 * the class time), so the client's "Last Entrance" and the dashboard's "Today
 * Entrances" reflect the class; un-marking removes that entrance.
 */
export async function toggleAttendance(enrollmentId: string, isAttending: boolean): Promise<SimpleResult> {
  const { supabase, profile } = await getAuthedProfile();
  const gymId = profile.gymId;

  const { data, error } = await supabase
    .from("class_enrollments")
    .update({ status: isAttending ? "attended" : "booked" })
    .eq("id", enrollmentId)
    .eq("gym_id", gymId)
    .select("session_id, client_id")
    .single();

  if (error) return { success: false, message: error.message };
  const { session_id, client_id } = data as { session_id: string; client_id: string };

  if (isAttending) {
    // Stamp the entrance at the session's start time (avoid duplicating it).
    const { data: existing } = await supabase
      .from("attendances")
      .select("id")
      .eq("gym_id", gymId)
      .eq("session_id", session_id)
      .eq("client_id", client_id)
      .limit(1)
      .maybeSingle();
    if (!existing) {
      const { data: s } = await supabase
        .from("class_sessions")
        .select("session_date, start_time")
        .eq("id", session_id)
        .eq("gym_id", gymId)
        .maybeSingle();
      const sess = s as { session_date: string; start_time: string } | null;
      // Stamp at the class start time (local wall-clock) so "Last Entrance" reads as the class time.
      const checkedInAt = sess
        ? (() => {
            const [y, m, d] = sess.session_date.split("-").map(Number);
            const [hh, mm, ss] = sess.start_time.split(":").map(Number);
            return new Date(y, m - 1, d, hh, mm, ss || 0).toISOString();
          })()
        : new Date().toISOString();
      await supabase
        .from("attendances")
        .insert({ gym_id: gymId, client_id, session_id, checked_in_at: checkedInAt });
      // Punch card: a newly-attended class consumes one credit on an active pass.
      await consumeClassPass(supabase, gymId, client_id, +1);
    }
  } else {
    const { data: removed } = await supabase
      .from("attendances")
      .delete()
      .eq("gym_id", gymId)
      .eq("session_id", session_id)
      .eq("client_id", client_id)
      .select("id");
    // Un-marking an attended class refunds the class-pass credit it consumed.
    if (removed && removed.length > 0) await consumeClassPass(supabase, gymId, client_id, -1);
  }

  revalidatePath("/classes/calendar");
  revalidatePath(`/clients/${client_id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

// =============================================================================
// Session CRUD — edit / cancel a single dated session, or stand down a whole
// recurring class. session_date/time/trainer/capacity live on class_sessions;
// kind_id/location_id live on the parent classes row (so editing them affects
// the template), per the schema.
// =============================================================================

export type SessionUpdateData = {
  classId: string;
  sessionDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  trainerId: string | null; // per-session substitute trainer
  capacity: number;
  kindId: string; // parent class
  locationId: string | null; // parent class
  notes?: string; // per-session note (interim store — gyms.settings.sessionNotes)
};

export async function updateSession(sessionId: string, data: SessionUpdateData): Promise<SimpleResult> {
  const { supabase, profile } = await getAuthedProfile();

  if (data.capacity < 1) return { success: false, message: "Capacity must be at least 1." };

  // Don't let capacity drop below the people already booked/attended.
  const { count, error: countError } = await supabase
    .from("class_enrollments")
    .select("*", { count: "exact", head: true })
    .eq("gym_id", profile.gymId)
    .eq("session_id", sessionId)
    .in("status", ["booked", "attended"]);
  if (countError) return { success: false, message: countError.message };
  if (data.capacity < (count ?? 0)) {
    return { success: false, message: `Capacity can't be below the ${count} already enrolled.` };
  }

  // The dated session row (date / time / substitute trainer / capacity).
  const { error: sessionError } = await supabase
    .from("class_sessions")
    .update({
      session_date: data.sessionDate,
      start_time: data.startTime,
      end_time: data.endTime,
      trainer_id: data.trainerId,
      capacity: data.capacity,
    })
    .eq("id", sessionId)
    .eq("gym_id", profile.gymId);

  if (sessionError) {
    // unique (class_id, session_date, start_time)
    if (sessionError.code === "23505") {
      return { success: false, message: "Another session of this class already exists at that date and time." };
    }
    return { success: false, message: sessionError.message };
  }

  // kind_id / location_id belong to the parent class template.
  const { error: classError } = await supabase
    .from("classes")
    .update({ kind_id: data.kindId, location_id: data.locationId })
    .eq("id", data.classId)
    .eq("gym_id", profile.gymId);
  if (classError) return { success: false, message: classError.message };

  // Per-session note lives on the class_sessions.notes column. Empty clears it.
  if (data.notes !== undefined) {
    const trimmed = data.notes.trim();
    const { error: notesError } = await supabase
      .from("class_sessions")
      .update({ notes: trimmed || null })
      .eq("id", sessionId)
      .eq("gym_id", profile.gymId);
    if (notesError) return { success: false, message: notesError.message };
  }

  revalidatePath("/classes/calendar");
  return { success: true };
}

/** Cancel one occurrence (soft — keeps the row + its roster for history). */
export async function deleteSingleSession(sessionId: string): Promise<SimpleResult> {
  const { supabase, profile } = await getAuthedProfile();

  const { error } = await supabase
    .from("class_sessions")
    .update({ status: "canceled" })
    .eq("id", sessionId)
    .eq("gym_id", profile.gymId);

  if (error) return { success: false, message: error.message };

  revalidatePath("/classes/calendar");
  return { success: true };
}

/**
 * Clear a recurring class's whole schedule. Removes the weekly hours (so the
 * calendar stops re-projecting it) and deletes EVERY occurrence — past and
 * future. The class definition itself stays ACTIVE (retiring it is the Classes
 * table's job), so it remains in the table ready to be re-scheduled.
 */
export async function deleteAllSessions(classId: string): Promise<SimpleResult> {
  const { supabase, profile } = await getAuthedProfile();

  // 1) Stop the recurrence — otherwise ensureSessionsForRange would regenerate
  //    future occurrences from the weekly hours on the next calendar view.
  const { error: slotError } = await supabase
    .from("class_time_slots")
    .delete()
    .eq("gym_id", profile.gymId)
    .eq("class_id", classId);
  if (slotError) return { success: false, message: slotError.message };

  // 2) Remove every occurrence (past + future) from the calendar.
  const { error: sessionsError } = await supabase
    .from("class_sessions")
    .delete()
    .eq("gym_id", profile.gymId)
    .eq("class_id", classId);
  if (sessionsError) return { success: false, message: sessionsError.message };

  revalidatePath("/classes/calendar");
  revalidatePath("/classes/table");
  return { success: true };
}
