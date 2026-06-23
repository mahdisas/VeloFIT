import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type SummaryData, type SummaryParams } from "@/lib/summary";

/**
 * Server-only summary aggregates for the share-card builder. RLS-scoped reads of
 * class_sessions + class_enrollments over the selected year or month.
 */

const pad = (n: number) => String(n).padStart(2, "0");

function periodBounds(params: SummaryParams): { start: string; end: string } {
  if (params.period === "year") return { start: `${params.year}-01-01`, end: `${params.year}-12-31` };
  const lastDay = new Date(params.year, params.month, 0).getDate();
  return {
    start: `${params.year}-${pad(params.month)}-01`,
    end: `${params.year}-${pad(params.month)}-${pad(lastDay)}`,
  };
}

function topKey(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

type SessionRow = { id: string; class: { kind: { name: string } | null } | null };
type EnrollRow = { client_id: string; session_id: string; client: { full_name: string } | null };

export async function getSummary(params: SummaryParams): Promise<SummaryData> {
  const { supabase, profile } = await getAuthedProfile();
  const gymId = profile.gymId;
  const { start, end } = periodBounds(params);

  // Lessons held in the period (excluding cancellations) + their kind names.
  const { data: sessionsData, error: sessionsError } = await supabase
    .from("class_sessions")
    .select("id, class:classes(kind:class_kinds(name))")
    .eq("gym_id", gymId)
    .gte("session_date", start)
    .lte("session_date", end)
    .neq("status", "canceled");
  if (sessionsError) throw new Error(`Failed to load summary: ${sessionsError.message}`);

  const sessions = (sessionsData ?? []) as unknown as SessionRow[];
  const totalLessons = sessions.length;
  const kindBySession = new Map(sessions.map((s) => [s.id, s.class?.kind?.name ?? null]));

  let totalTrainees = 0;
  let mostRequestedClass = "—";
  let mostRegisteredTrainee = "—";

  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length > 0) {
    const { data: enrollData, error: enrollError } = await supabase
      .from("class_enrollments")
      .select("client_id, session_id, client:clients(full_name)")
      .eq("gym_id", gymId)
      .in("session_id", sessionIds)
      .in("status", ["booked", "attended"]);
    if (enrollError) throw new Error(`Failed to load summary: ${enrollError.message}`);

    const enrollments = (enrollData ?? []) as unknown as EnrollRow[];
    totalTrainees = new Set(enrollments.map((e) => e.client_id)).size;

    const kindCounts = new Map<string, number>();
    const traineeCounts = new Map<string, number>();
    for (const e of enrollments) {
      const kind = kindBySession.get(e.session_id);
      if (kind) kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
      const name = e.client?.full_name;
      if (name) traineeCounts.set(name, (traineeCounts.get(name) ?? 0) + 1);
    }
    mostRequestedClass = topKey(kindCounts) ?? "—";
    mostRegisteredTrainee = topKey(traineeCounts) ?? "—";
  }

  return { totalTrainees, totalLessons, mostRequestedClass, mostRegisteredTrainee };
}
