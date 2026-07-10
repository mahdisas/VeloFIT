"use client";

import * as React from "react";
import { Loader2, Lock } from "lucide-react";

import { loadCalendarSessions } from "@/app/(app)/classes/calendar/actions";
import { ClassAttendanceSheet } from "@/components/mobile/class-attendance-sheet";
import { MobileClassCard } from "@/components/mobile/mobile-class-card";
import { WeekDatePicker } from "@/components/mobile/week-date-picker";
import { addDays, toISO, type CalendarSession, type CalendarSessionMap } from "@/lib/calendar";
import { useLocale, useT } from "@/lib/i18n/provider";

export function MobileHome({ initialSessions }: { initialSessions: CalendarSessionMap }) {
  const t = useT();
  const locale = useLocale();

  // Local "today" (the client's clock — authoritative for the user's calendar).
  const today = React.useMemo(() => toISO(new Date()), []);
  const [selected, setSelected] = React.useState(today);

  // Cache of sessions per date + the set of dates we've already fetched (so an
  // empty day isn't re-fetched forever). Seed with the server-prefetched window.
  const [byDate, setByDate] = React.useState<CalendarSessionMap>(initialSessions);
  const [loaded, setLoaded] = React.useState<Set<string>>(() => {
    const set = new Set<string>();
    // The page prefetched [today-2 … today+2] (server clock); local today is
    // within ±1 of that, so it's always covered.
    const now = new Date();
    for (let i = -2; i <= 2; i++) set.add(toISO(addDays(now, i)));
    return set;
  });
  const [loadingDate, setLoadingDate] = React.useState<string | null>(null);

  // Localized formatter for the selected-day label under the picker.
  const fmt = React.useMemo(
    () => ({
      full: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
    }),
    [locale]
  );

  // Fetch a day's sessions the first time it's selected.
  React.useEffect(() => {
    if (loaded.has(selected)) return;
    let active = true;
    setLoadingDate(selected);
    loadCalendarSessions(selected, selected)
      .then((map) => {
        if (!active) return;
        setByDate((prev) => ({ ...prev, [selected]: map[selected] ?? [] }));
        setLoaded((prev) => new Set(prev).add(selected));
      })
      .finally(() => active && setLoadingDate((d) => (d === selected ? null : d)));
    return () => {
      active = false;
    };
  }, [selected, loaded]);

  // Optimistic enrolled-count bump from the attendance sheet (keeps card badges in sync).
  const adjustEnrolled = React.useCallback((sessionId: string, delta: number) => {
    setByDate((prev) => {
      const next: CalendarSessionMap = {};
      for (const [date, list] of Object.entries(prev)) {
        next[date] = list.map((s) =>
          s.id === sessionId ? { ...s, enrolled: Math.max(0, s.enrolled + delta) } : s
        );
      }
      return next;
    });
  }, []);

  const selectedDateObj = React.useMemo(() => {
    const [y, m, d] = selected.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selected]);

  const sessions = (byDate[selected] ?? [])
    .filter((s) => !s.canceled)
    .slice()
    .sort((a, b) => a.from.localeCompare(b.from));
  const isLoading = loadingDate === selected && !loaded.has(selected);
  const isSelectedPast = selected < today;

  const [openSession, setOpenSession] = React.useState<CalendarSession | null>(null);

  // A canceled class drops out of the day's list (MobileHome filters !canceled).
  const markSessionCanceled = React.useCallback((sessionId: string) => {
    setByDate((prev) => {
      const next: CalendarSessionMap = {};
      for (const [date, list] of Object.entries(prev)) {
        next[date] = list.map((s) => (s.id === sessionId ? { ...s, canceled: true } : s));
      }
      return next;
    });
    setOpenSession(null);
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      {/* Sticky week-by-week date picker (arrows + fold-out month calendar). */}
      <WeekDatePicker selected={selected} onSelect={setSelected} lockPast />

      {/* Class list for the selected day */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground capitalize" dir="auto">
            {fmt.full.format(selectedDateObj)}
          </p>
          {isSelectedPast && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Lock className="size-3" /> {t("Past — view only")}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <span className="text-sm">{t("Loading…")}</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <p className="text-sm">{t("No classes scheduled")}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <MobileClassCard
                key={s.id}
                name={s.name}
                color={s.color}
                from={s.from}
                to={s.to}
                trainerName={s.trainer}
                enrolled={s.enrolled}
                capacity={s.capacity}
                showParticipants
                onClick={() => setOpenSession(s)}
              />
            ))}
          </div>
        )}
      </div>

      <ClassAttendanceSheet
        session={openSession}
        date={selectedDateObj}
        isPast={isSelectedPast}
        open={openSession !== null}
        onOpenChange={(o) => !o && setOpenSession(null)}
        adjustEnrolled={adjustEnrolled}
        onCanceled={markSessionCanceled}
      />
    </div>
  );
}
