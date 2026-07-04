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
      // Staff bypass the capacity trigger (migration 00021 — deliberate
      // overbooking is allowed from the dashboard), so 23514 can only occur on
      // a DB that hasn't applied it yet. Kept as a graceful fallback.
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
 * Approve/Promote (→ booked). Staff bypass the capacity trigger (00021), so
 * approving over a full class succeeds by design; SESSION_FULL remains only as
 * a pre-migration fallback.
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

export type WaitlistEntry = {
  enrollmentId: string;
  clientName: string;
  className: string;
  color: string;
  date: string; // ISO
  from: string;
  to: string;
};

type WaitlistRow = {
  id: string;
  client: { full_name: string } | null;
  session: {
    session_date: string;
    start_time: string;
    end_time: string;
    status: string;
    class: { name: string | null; color: string | null; kind: { name: string; color: string } | null } | null;
  } | null;
};

/**
 * The gym's pending waitlist — every 'waitlisted' enrollment for an upcoming,
 * non-canceled session, soonest first. Feeds the veloFIT app's owner Waiting List,
 * where staff approve (→ booked) or reject (→ canceled) via setEnrollmentStatus.
 * RLS scopes rows to the caller's gym.
 */
export async function getGymWaitlist(): Promise<WaitlistEntry[]> {
  const { supabase, profile } = await getAuthedProfile();
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;

  const { data } = await supabase
    .from("class_enrollments")
    .select(
      `id, client:clients(full_name),
       session:class_sessions(session_date, start_time, end_time, status,
         class:classes(name, color, kind:class_kinds(name, color)))`
    )
    .eq("gym_id", profile.gymId)
    .eq("status", "waitlisted");

  const rows = ((data ?? []) as unknown as WaitlistRow[]).filter(
    (r) => r.session && r.session.status !== "canceled" && r.session.session_date >= today
  );

  return rows
    .map((r) => {
      const s = r.session!;
      return {
        enrollmentId: r.id,
        clientName: r.client?.full_name ?? "—",
        className: s.class?.name ?? s.class?.kind?.name ?? "—",
        color: s.class?.color ?? s.class?.kind?.color ?? "#ec1c79",
        date: s.session_date,
        from: s.start_time.slice(0, 5),
        to: s.end_time.slice(0, 5),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.from.localeCompare(b.from));
}

export type AttendanceEntry = {
  id: string;
  clientName: string;
  className: string; // "" for a plain gym visit (no session)
  color: string;
  at: string; // checked_in_at ISO timestamp
};

type AttendanceRow = {
  id: string;
  checked_in_at: string;
  client: { full_name: string } | null;
  session: { class: { name: string | null; color: string | null; kind: { name: string; color: string } | null } | null } | null;
};

/**
 * The gym's most recent check-ins (door entrances + class attendance), newest
 * first — the owner's "Activity" feed in the veloFIT app. RLS scopes to the gym.
 */
export async function getRecentAttendance(limit = 40): Promise<AttendanceEntry[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data } = await supabase
    .from("attendances")
    .select(
      `id, checked_in_at, client:clients(full_name),
       session:class_sessions(class:classes(name, color, kind:class_kinds(name, color)))`
    )
    .eq("gym_id", profile.gymId)
    .order("checked_in_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as AttendanceRow[]).map((r) => {
    const cls = r.session?.class ?? null;
    return {
      id: r.id,
      clientName: r.client?.full_name ?? "—",
      className: cls?.name ?? cls?.kind?.name ?? "",
      color: cls?.color ?? cls?.kind?.color ?? "#ec1c79",
      at: r.checked_in_at,
    };
  });
}

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

  // One round trip: flip the status AND pull the session's date/time via the
  // join — the front desk taps these checkboxes rapid-fire, so every saved
  // round trip is felt directly in the UI.
  const { data, error } = await supabase
    .from("class_enrollments")
    .update({ status: isAttending ? "attended" : "booked" })
    .eq("id", enrollmentId)
    .eq("gym_id", gymId)
    .select("session_id, client_id, session:class_sessions(session_date, start_time)")
    .single();

  if (error) return { success: false, message: error.message };
  const { session_id, client_id, session } = data as unknown as {
    session_id: string;
    client_id: string;
    session: { session_date: string; start_time: string } | null;
  };

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
      // Stamp at the class start time (local wall-clock) so "Last Entrance" reads as the class time.
      const checkedInAt = session
        ? (() => {
            const [y, m, d] = session.session_date.split("-").map(Number);
            const [hh, mm, ss] = session.start_time.split(":").map(Number);
            return new Date(y, m - 1, d, hh, mm, ss || 0).toISOString();
          })()
        : new Date().toISOString();
      // The entrance log and the punch-card credit are independent — run both at once.
      await Promise.all([
        supabase.from("attendances").insert({ gym_id: gymId, client_id, session_id, checked_in_at: checkedInAt }),
        consumeClassPass(supabase, gymId, client_id, +1),
      ]);
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
