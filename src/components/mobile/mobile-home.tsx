"use client";

import * as React from "react";
import { Loader2, Lock, Users } from "lucide-react";

import { loadCalendarSessions } from "@/app/(app)/classes/calendar/actions";
import { ClassAttendanceSheet } from "@/components/mobile/class-attendance-sheet";
import { addDays, toISO, type CalendarSession, type CalendarSessionMap } from "@/lib/calendar";
import { useLocale, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Days of past/future shown in the horizontal scroller, relative to today. */
const PAST_DAYS = 7;
const FUTURE_DAYS = 35;

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

  // The dates rendered in the scroller.
  const days = React.useMemo(() => {
    const base = new Date();
    return Array.from({ length: PAST_DAYS + FUTURE_DAYS + 1 }, (_, i) => addDays(base, i - PAST_DAYS));
  }, []);

  // Localized formatters (weekday + month names follow the active locale; the
  // day number stays Latin for consistency with the rest of the app).
  const fmt = React.useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      monthYear: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
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

  // Center the selected chip on first paint.
  const selectedChipRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    selectedChipRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

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
      {/* Sticky date scroller */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex items-baseline justify-between px-4 pt-3">
          <h1 className="font-heading text-lg font-semibold capitalize" dir="auto">
            {fmt.monthYear.format(selectedDateObj)}
          </h1>
          {selected !== today && (
            <button
              type="button"
              onClick={() => setSelected(today)}
              className="text-sm font-medium text-primary"
            >
              {t("Today")}
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-3 py-3 scrollbar-hide">
          {days.map((d) => {
            const iso = toISO(d);
            const isSel = iso === selected;
            const isToday = iso === today;
            const isPast = iso < today; // past days are view-only (no enrolling)
            return (
              <button
                key={iso}
                ref={isSel ? selectedChipRef : undefined}
                type="button"
                onClick={() => setSelected(iso)}
                className={cn(
                  "flex w-12 shrink-0 flex-col items-center gap-1 rounded-2xl py-2 transition-colors",
                  isSel
                    ? "bg-primary text-primary-foreground"
                    : cn("text-muted-foreground hover:bg-muted", isPast && "opacity-45")
                )}
              >
                <span className="text-[11px] capitalize">{fmt.weekday.format(d)}</span>
                <span className="text-base font-semibold leading-none">{d.getDate()}</span>
                {isPast ? (
                  <Lock className="size-2.5" />
                ) : (
                  <span
                    className={cn(
                      "size-1 rounded-full",
                      isToday ? (isSel ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

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
              <button
                key={s.id}
                type="button"
                onClick={() => setOpenSession(s)}
                className="flex items-stretch gap-3 rounded-2xl border bg-card p-3 text-start shadow-sm transition-colors hover:border-primary/40 active:bg-muted/50"
              >
                <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium" dir="auto">{s.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground" dir="ltr">
                      {s.from}–{s.to}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {s.trainer && <span dir="auto" className="truncate">{s.trainer}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" /> {s.enrolled}/{s.capacity}
                    </span>
                  </div>
                </div>
              </button>
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
