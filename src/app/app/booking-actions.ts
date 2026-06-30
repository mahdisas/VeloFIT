"use server";

import { type AppViewer, getAppViewer } from "@/lib/app-viewer";
import { type CalendarSessionMap } from "@/lib/calendar";
import { ensureSessionsForRange, fetchCalendarSessions } from "@/lib/classes-server";

/** Local-clock "YYYY-MM-DD" on the server. */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local-clock "HH:MM" on the server. */
function nowHm(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * A session is "past" once its END time has passed — date before today, or today
 * but already finished. (Date-only checks let a class that ended earlier today
 * still be reserved, which is the bug this guards against.) `endTime` may be
 * "HH:MM" or "HH:MM:SS"; both compare correctly once sliced.
 */
function isPastSession(sessionDate: string, endTime: string): boolean {
  const today = todayIso();
  if (sessionDate !== today) return sessionDate < today;
  return endTime.slice(0, 5) <= nowHm();
}

/**
 * The class ids a member may see/book = classes in any group their ACTIVE
 * subscriptions belong to (subscriptions → plan.group_id → class_group_classes).
 * The single source of truth for member class eligibility — every member class
 * read/booking re-derives this server-side so it can't be spoofed.
 */
async function memberGroupClassIds(viewer: Extract<AppViewer, { kind: "member" }>): Promise<Set<string>> {
  const today = todayIso();
  const { data: subs } = await viewer.supabase
    .from("subscriptions")
    .select("plan:subscription_plans(group_id)")
    .eq("gym_id", viewer.gymId)
    .eq("client_id", viewer.clientId)
    .eq("status", "active")
    .lte("start_date", today)
    .gte("end_date", today);

  const groupIds = [
    ...new Set(
      ((subs ?? []) as unknown as { plan: { group_id: string | null } | null }[])
        .map((s) => s.plan?.group_id)
        .filter((g): g is string => Boolean(g))
    ),
  ];
  if (groupIds.length === 0) return new Set();

  const { data: links } = await viewer.supabase
    .from("class_group_classes")
    .select("class_id")
    .eq("gym_id", viewer.gymId)
    .in("group_id", groupIds);
  return new Set(((links ?? []) as { class_id: string }[]).map((l) => l.class_id));
}

/** Member-scoped sessions for a date window, filtered to the member's groups. */
export async function getMemberSessions(start: string, end: string): Promise<CalendarSessionMap> {
  const viewer = await getAppViewer();
  if (viewer.kind !== "member") return {};

  const classIds = await memberGroupClassIds(viewer);
  if (classIds.size === 0) return {};

  await ensureSessionsForRange(viewer.supabase, viewer.gymId, start, end);
  const map = await fetchCalendarSessions(viewer.supabase, viewer.gymId, start, end);

  const filtered: CalendarSessionMap = {};
  for (const [date, list] of Object.entries(map)) {
    const keep = list.filter((s) => classIds.has(s.classId));
    if (keep.length) filtered[date] = keep;
  }
  return filtered;
}

export type EnrollmentStatus = "booked" | "waitlisted" | "attended" | "canceled" | "no_show";

export type MemberClassDetail = {
  sessionId: string;
  name: string;
  color: string;
  kindName: string;
  trainerName: string;
  locationName: string;
  date: string; // ISO
  from: string;
  to: string;
  capacity: number;
  enrolled: number; // booked + attended
  allowWaitlist: boolean;
  showRoster: boolean; // classes.show_enroll_list — may the member see participant names?
  showCount: boolean; // classes.show_max_participants — may the member see the enrolled/capacity counter?
  roster: { name: string; status: EnrollmentStatus }[] | null; // null when not allowed
  myStatus: EnrollmentStatus | null;
  isPast: boolean;
};

type DetailRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  capacity: number;
  trainer_id: string | null;
  class: {
    id: string;
    name: string | null;
    color: string | null;
    show_enroll_list: boolean;
    show_max_participants: boolean;
    allow_waiting_list: boolean;
    trainer_id: string | null;
    kind: { name: string; color: string } | null;
    location: { name: string } | null;
  } | null;
};
type EnrRow = { status: string; client_id: string; client: { full_name: string } | null };

/** Full class detail for the member booking sheet (roster only if allowed). */
export async function getMemberClassDetail(sessionId: string): Promise<MemberClassDetail | null> {
  const viewer = await getAppViewer();
  if (viewer.kind !== "member") return null;

  const { data } = await viewer.supabase
    .from("class_sessions")
    .select(
      `id, session_date, start_time, end_time, status, capacity, trainer_id,
       class:classes(id, name, color, show_enroll_list, show_max_participants, allow_waiting_list, trainer_id,
         kind:class_kinds(name, color), location:locations(name))`
    )
    .eq("id", sessionId)
    .eq("gym_id", viewer.gymId)
    .maybeSingle();
  if (!data) return null;
  const s = data as unknown as DetailRow;

  const { data: enrData } = await viewer.supabase
    .from("class_enrollments")
    .select("status, client_id, client:clients(full_name)")
    .eq("gym_id", viewer.gymId)
    .eq("session_id", sessionId);
  const enr = (enrData ?? []) as unknown as EnrRow[];

  const enrolled = enr.filter((e) => e.status === "booked" || e.status === "attended").length;
  const mine = enr.find((e) => e.client_id === viewer.clientId);

  // Bookable only when the class is in the member's groups; but a class they
  // already have an enrollment in (e.g. an attended class in History whose group
  // they've since left) stays viewable read-only.
  const classId = s.class?.id;
  const classIds = await memberGroupClassIds(viewer);
  if (!classId || (!classIds.has(classId) && !mine)) return null;
  const showRoster = s.class?.show_enroll_list ?? false;
  const roster = showRoster
    ? enr
        .filter((e) => ["booked", "attended", "waitlisted"].includes(e.status))
        .map((e) => ({ name: e.client?.full_name ?? "—", status: e.status as EnrollmentStatus }))
    : null;

  const trainerId = s.trainer_id ?? s.class?.trainer_id ?? null;
  let trainerName = "";
  if (trainerId) {
    const { data: tr } = await viewer.supabase.from("trainers").select("full_name").eq("id", trainerId).maybeSingle();
    trainerName = (tr as { full_name: string } | null)?.full_name ?? "";
  }

  return {
    sessionId: s.id,
    name: s.class?.name ?? s.class?.kind?.name ?? "—",
    color: s.class?.color ?? s.class?.kind?.color ?? "#ec1c79",
    kindName: s.class?.kind?.name ?? "",
    trainerName,
    locationName: s.class?.location?.name ?? "",
    date: s.session_date,
    from: s.start_time.slice(0, 5),
    to: s.end_time.slice(0, 5),
    capacity: s.capacity,
    enrolled,
    allowWaitlist: s.class?.allow_waiting_list ?? false,
    showRoster,
    showCount: s.class?.show_max_participants ?? false,
    roster,
    myStatus: mine ? (mine.status as EnrollmentStatus) : null,
    isPast: isPastSession(s.session_date, s.end_time),
  };
}

export type MyClass = {
  sessionId: string;
  name: string;
  color: string;
  date: string;
  from: string;
  to: string;
  trainerName: string;
  capacity: number;
  enrolled: number; // booked + attended
  showCount: boolean; // classes.show_max_participants — show the enrolled/capacity counter?
  myStatus: EnrollmentStatus;
};

type MyRow = {
  status: string;
  session: {
    id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    status: string;
    capacity: number;
    trainer_id: string | null;
    class: { name: string | null; color: string | null; trainer_id: string | null; show_max_participants: boolean; kind: { name: string; color: string } | null } | null;
  } | null;
};

/** The member's own upcoming bookings (booked / waitlisted), soonest first. */
export async function getMySchedule(): Promise<MyClass[]> {
  const viewer = await getAppViewer();
  if (viewer.kind !== "member") return [];
  const today = todayIso();

  const { data } = await viewer.supabase
    .from("class_enrollments")
    .select(
      `status, session:class_sessions(id, session_date, start_time, end_time, status, capacity, trainer_id,
         class:classes(name, color, trainer_id, show_max_participants, kind:class_kinds(name, color)))`
    )
    .eq("gym_id", viewer.gymId)
    .eq("client_id", viewer.clientId)
    .in("status", ["booked", "waitlisted", "attended"]);

  const rows = ((data ?? []) as unknown as MyRow[]).filter(
    (r) => r.session && r.session.status !== "canceled" && r.session.session_date >= today
  );
  if (rows.length === 0) return [];

  // Live enrolled (booked + attended) count per session.
  const sessionIds = rows.map((r) => r.session!.id);
  const { data: enr } = await viewer.supabase
    .from("class_enrollments")
    .select("session_id")
    .eq("gym_id", viewer.gymId)
    .in("session_id", sessionIds)
    .in("status", ["booked", "attended"]);
  const enrolledBy = new Map<string, number>();
  for (const e of (enr ?? []) as { session_id: string }[]) {
    enrolledBy.set(e.session_id, (enrolledBy.get(e.session_id) ?? 0) + 1);
  }

  // Resolve trainer names once.
  const { data: tr } = await viewer.supabase.from("trainers").select("id, full_name").eq("gym_id", viewer.gymId);
  const trainerName = new Map(((tr ?? []) as { id: string; full_name: string }[]).map((t) => [t.id, t.full_name]));

  return rows
    .map((r) => {
      const s = r.session!;
      const trainerId = s.trainer_id ?? s.class?.trainer_id ?? null;
      return {
        sessionId: s.id,
        name: s.class?.name ?? s.class?.kind?.name ?? "—",
        color: s.class?.color ?? s.class?.kind?.color ?? "#ec1c79",
        date: s.session_date,
        from: s.start_time.slice(0, 5),
        to: s.end_time.slice(0, 5),
        trainerName: (trainerId && trainerName.get(trainerId)) || "",
        capacity: s.capacity,
        enrolled: enrolledBy.get(s.id) ?? 0,
        showCount: s.class?.show_max_participants ?? false,
        myStatus: r.status as EnrollmentStatus,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.from.localeCompare(b.from));
}

/**
 * The member's visit history — past classes they actually attended (enrollment
 * status 'attended'), newest first. Counts are omitted (showCount=false): a
 * history card shows what/when they came, not a live roster.
 */
export async function getMyHistory(): Promise<MyClass[]> {
  const viewer = await getAppViewer();
  if (viewer.kind !== "member") return [];

  const { data } = await viewer.supabase
    .from("class_enrollments")
    .select(
      `status, session:class_sessions(id, session_date, start_time, end_time, status, capacity, trainer_id,
         class:classes(name, color, trainer_id, show_max_participants, kind:class_kinds(name, color)))`
    )
    .eq("gym_id", viewer.gymId)
    .eq("client_id", viewer.clientId)
    .eq("status", "attended");

  const rows = ((data ?? []) as unknown as MyRow[]).filter((r) => r.session && r.session.status !== "canceled");
  if (rows.length === 0) return [];

  const { data: tr } = await viewer.supabase.from("trainers").select("id, full_name").eq("gym_id", viewer.gymId);
  const trainerName = new Map(((tr ?? []) as { id: string; full_name: string }[]).map((t) => [t.id, t.full_name]));

  return rows
    .map((r) => {
      const s = r.session!;
      const trainerId = s.trainer_id ?? s.class?.trainer_id ?? null;
      return {
        sessionId: s.id,
        name: s.class?.name ?? s.class?.kind?.name ?? "—",
        color: s.class?.color ?? s.class?.kind?.color ?? "#ec1c79",
        date: s.session_date,
        from: s.start_time.slice(0, 5),
        to: s.end_time.slice(0, 5),
        trainerName: (trainerId && trainerName.get(trainerId)) || "",
        capacity: s.capacity,
        enrolled: 0,
        showCount: false,
        myStatus: "attended" as EnrollmentStatus,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.from.localeCompare(a.from));
}

export type ReserveResult =
  | { ok: true; status: "booked" | "waitlisted" }
  | { ok: false; error: "FULL" | "NOT_ALLOWED" | "ALREADY" | "PAST" | "ERROR" };

/**
 * Reserve the member's own spot in a session. Re-derives group eligibility, then
 * tries a 'booked' enrollment; if the capacity trigger fires (errcode 23514),
 * falls back to 'waitlisted' when the class allows it. The DB trigger remains the
 * authoritative, race-safe capacity guard.
 */
export async function reserveSpot(sessionId: string): Promise<ReserveResult> {
  const viewer = await getAppViewer();
  if (viewer.kind !== "member") return { ok: false, error: "ERROR" };

  const { data } = await viewer.supabase
    .from("class_sessions")
    .select("id, session_date, end_time, status, class:classes(id, allow_waiting_list)")
    .eq("id", sessionId)
    .eq("gym_id", viewer.gymId)
    .maybeSingle();
  const s = data as unknown as { id: string; session_date: string; end_time: string; status: string; class: { id: string; allow_waiting_list: boolean } | null } | null;
  if (!s || s.status === "canceled") return { ok: false, error: "ERROR" };
  if (isPastSession(s.session_date, s.end_time)) return { ok: false, error: "PAST" };

  const classId = s.class?.id;
  const classIds = await memberGroupClassIds(viewer);
  if (!classId || !classIds.has(classId)) return { ok: false, error: "NOT_ALLOWED" };
  const allowWaitlist = s.class?.allow_waiting_list ?? false;

  // Reuse a prior (canceled) enrollment row if present; else insert a new one.
  const { data: existing } = await viewer.supabase
    .from("class_enrollments")
    .select("id, status")
    .eq("gym_id", viewer.gymId)
    .eq("session_id", sessionId)
    .eq("client_id", viewer.clientId)
    .maybeSingle();
  const ex = existing as { id: string; status: string } | null;
  if (ex && ["booked", "waitlisted", "attended"].includes(ex.status)) return { ok: false, error: "ALREADY" };

  const setStatus = (status: "booked" | "waitlisted") =>
    ex
      ? viewer.supabase.from("class_enrollments").update({ status }).eq("id", ex.id).select("id").single()
      : viewer.supabase
          .from("class_enrollments")
          .insert({ gym_id: viewer.gymId, session_id: sessionId, client_id: viewer.clientId, status })
          .select("id")
          .single();

  const booked = await setStatus("booked");
  if (!booked.error) return { ok: true, status: "booked" };
  if (booked.error.code === "23514" && /is full/i.test(booked.error.message)) {
    if (!allowWaitlist) return { ok: false, error: "FULL" };
    const wl = await setStatus("waitlisted");
    return wl.error ? { ok: false, error: "ERROR" } : { ok: true, status: "waitlisted" };
  }
  if (booked.error.code === "23505") return { ok: false, error: "ALREADY" };
  return { ok: false, error: "ERROR" };
}

/** Cancel / leave the member's own reservation for a session. */
export async function cancelReservation(sessionId: string): Promise<{ ok: boolean }> {
  const viewer = await getAppViewer();
  if (viewer.kind !== "member") return { ok: false };
  const { error } = await viewer.supabase
    .from("class_enrollments")
    .update({ status: "canceled" })
    .eq("gym_id", viewer.gymId)
    .eq("session_id", sessionId)
    .eq("client_id", viewer.clientId);
  return { ok: !error };
}
