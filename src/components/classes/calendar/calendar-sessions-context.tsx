"use client";

import * as React from "react";

import { loadCalendarSessions } from "@/app/(app)/classes/calendar/actions";
import {
  type CalendarSession,
  type CalendarSessionMap,
  type CalendarView,
  toISO,
  visibleRange,
} from "@/lib/calendar";

/**
 * Holds the real, gym-scoped sessions for the calendar grid. Seeded server-side
 * with the initial window; as the user navigates, `ensureRange` lazily fetches
 * uncached windows (deduped by key) and merges them in. The grid components read
 * `sessionsForDate(date)` instead of any mock generator.
 */
type CalendarSessionsCtx = {
  sessionsForDate: (date: Date) => CalendarSession[];
  ensureRange: (start: string, end: string) => void;
  /** Optimistically bump a session's enrolled count on the grid (e.g. after enrolling). */
  adjustEnrolled: (sessionId: string, delta: number) => void;
  /** Drop a single session from the grid (after cancel/delete). */
  removeSession: (sessionId: string) => void;
  /** Drop a class's sessions on/after `fromDateISO` (after "Delete All Classes"). */
  removeSessionsByClass: (classId: string, fromDateISO: string) => void;
  /** Apply an edit: move the session to `newDateISO` and patch its fields. */
  moveSession: (sessionId: string, newDateISO: string, patch: Partial<CalendarSession>) => void;
  /** Merge freshly-created sessions (by date) into the grid (after quick-add). */
  mergeSessions: (incoming: CalendarSessionMap) => void;
  loading: boolean;
};

const Ctx = React.createContext<CalendarSessionsCtx | null>(null);

export function CalendarSessionsProvider({
  initial,
  initialRange,
  children,
}: {
  initial: CalendarSessionMap;
  initialRange: { start: string; end: string };
  children: React.ReactNode;
}) {
  const [map, setMap] = React.useState<CalendarSessionMap>(initial);
  const [loading, setLoading] = React.useState(false);
  const loaded = React.useRef(new Set<string>([`${initialRange.start}_${initialRange.end}`]));

  const ensureRange = React.useCallback((start: string, end: string) => {
    const key = `${start}_${end}`;
    if (loaded.current.has(key)) return;
    loaded.current.add(key);
    setLoading(true);
    loadCalendarSessions(start, end)
      .then((res) => setMap((prev) => ({ ...prev, ...res })))
      .catch(() => loaded.current.delete(key)) // allow a retry on the next navigation
      .finally(() => setLoading(false));
  }, []);

  const sessionsForDate = React.useCallback((date: Date) => map[toISO(date)] ?? [], [map]);

  const adjustEnrolled = React.useCallback((sessionId: string, delta: number) => {
    setMap((prev) => {
      let changed = false;
      const next: CalendarSessionMap = {};
      for (const [date, list] of Object.entries(prev)) {
        next[date] = list.map((s) => {
          if (s.id !== sessionId) return s;
          changed = true;
          return { ...s, enrolled: Math.max(0, s.enrolled + delta) };
        });
      }
      return changed ? next : prev;
    });
  }, []);

  const removeSession = React.useCallback((sessionId: string) => {
    setMap((prev) => {
      let changed = false;
      const next: CalendarSessionMap = {};
      for (const [date, list] of Object.entries(prev)) {
        const filtered = list.filter((s) => s.id !== sessionId);
        if (filtered.length !== list.length) changed = true;
        next[date] = filtered;
      }
      return changed ? next : prev;
    });
  }, []);

  const removeSessionsByClass = React.useCallback((classId: string, fromDateISO: string) => {
    setMap((prev) => {
      let changed = false;
      const next: CalendarSessionMap = {};
      for (const [date, list] of Object.entries(prev)) {
        // Only future occurrences are canceled server-side; mirror that here.
        if (date < fromDateISO) {
          next[date] = list;
          continue;
        }
        const filtered = list.filter((s) => s.classId !== classId);
        if (filtered.length !== list.length) changed = true;
        next[date] = filtered;
      }
      return changed ? next : prev;
    });
  }, []);

  const moveSession = React.useCallback(
    (sessionId: string, newDateISO: string, patch: Partial<CalendarSession>) => {
      setMap((prev) => {
        let moved: CalendarSession | undefined;
        const next: CalendarSessionMap = {};
        for (const [date, list] of Object.entries(prev)) {
          const kept: CalendarSession[] = [];
          for (const s of list) {
            if (s.id === sessionId) moved = { ...s, ...patch };
            else kept.push(s);
          }
          next[date] = kept;
        }
        if (!moved) return prev;
        next[newDateISO] = [...(next[newDateISO] ?? []), moved];
        return next;
      });
    },
    []
  );

  const mergeSessions = React.useCallback((incoming: CalendarSessionMap) => {
    setMap((prev) => ({ ...prev, ...incoming }));
  }, []);

  const value = React.useMemo(
    () => ({
      sessionsForDate,
      ensureRange,
      adjustEnrolled,
      removeSession,
      removeSessionsByClass,
      moveSession,
      mergeSessions,
      loading,
    }),
    [sessionsForDate, ensureRange, adjustEnrolled, removeSession, removeSessionsByClass, moveSession, mergeSessions, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCalendarSessions(): CalendarSessionsCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useCalendarSessions must be used within a CalendarSessionsProvider");
  return ctx;
}

/**
 * Invisible effect component: keeps the cache warm for the currently-visible
 * window. Lives inside the provider so it can call `ensureRange`.
 */
export function CalendarRangeLoader({ view, cursor }: { view: CalendarView; cursor: Date }) {
  const { ensureRange } = useCalendarSessions();
  React.useEffect(() => {
    const { start, end } = visibleRange(view, cursor);
    ensureRange(start, end);
  }, [view, cursor, ensureRange]);
  return null;
}
