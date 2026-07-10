"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Lock } from "lucide-react";

import { addDays, fromISO, toISO } from "@/lib/calendar";
import { useLocale, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Local midnight of the Sunday that starts this date's week. */
function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -x.getDay()); // getDay(): 0 = Sunday
}

/**
 * The Schedules date header: one week at a time (Sun–Sat), prev/next-week
 * arrows, and a tappable month button that unfolds a full month calendar to
 * jump anywhere — no more endless horizontal scrolling. Weeks are unbounded
 * in both directions.
 *
 * `lockPast` renders past days with the little lock (the owner's view-only
 * marker); members get plain chips.
 */
export function WeekDatePicker({
  selected,
  onSelect,
  lockPast = false,
}: {
  selected: string; // ISO "YYYY-MM-DD"
  onSelect: (iso: string) => void;
  lockPast?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const today = React.useMemo(() => toISO(new Date()), []);

  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(fromISO(selected)));
  const [monthOpen, setMonthOpen] = React.useState(false);
  // First day of the month shown in the unfolded calendar.
  const [monthCursor, setMonthCursor] = React.useState(() => {
    const d = fromISO(selected);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const fmt = React.useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      weekdayNarrow: new Intl.DateTimeFormat(locale, { weekday: "narrow" }),
      monthYear: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    }),
    [locale]
  );

  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // The title follows what's on screen: the open month, or the week's midpoint
  // (so a week spanning two months is labeled by the month holding most of it).
  const titleDate = monthOpen ? monthCursor : addDays(weekStart, 3);

  const goToday = () => {
    const now = new Date();
    onSelect(today);
    setWeekStart(startOfWeek(now));
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Opening the calendar always lands on the month of the week on screen
  // (the arrows may have paged weeks without touching the month cursor).
  const toggleMonth = () => {
    if (!monthOpen) {
      const mid = addDays(weekStart, 3);
      setMonthCursor(new Date(mid.getFullYear(), mid.getMonth(), 1));
    }
    setMonthOpen(!monthOpen);
  };

  const step = (dir: 1 | -1) => {
    if (monthOpen) {
      setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1));
    } else {
      setWeekStart((w) => addDays(w, dir * 7));
    }
  };

  const pick = (d: Date) => {
    onSelect(toISO(d));
    setWeekStart(startOfWeek(d));
    setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setMonthOpen(false);
  };

  // 6 fixed rows cover every month layout; keeps the fold-out height stable.
  const monthGrid = React.useMemo(() => {
    const first = startOfWeek(monthCursor);
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, i) => addDays(first, w * 7 + i))
    );
  }, [monthCursor]);

  const dayChip = (d: Date) => {
    const iso = toISO(d);
    const isSel = iso === selected;
    const isToday = iso === today;
    const isPast = iso < today;
    return (
      <button
        key={iso}
        type="button"
        onClick={() => pick(d)}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition-colors",
          isSel
            ? "bg-primary text-primary-foreground"
            : cn("text-muted-foreground hover:bg-muted", lockPast && isPast && "opacity-45")
        )}
      >
        <span className="text-[11px] capitalize">{fmt.weekday.format(d)}</span>
        <span className="text-base font-semibold leading-none">{d.getDate()}</span>
        {lockPast && isPast ? (
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
  };

  return (
    <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        {/* Month title doubles as the full-calendar toggle. */}
        <button
          type="button"
          onClick={toggleMonth}
          aria-expanded={monthOpen}
          className="flex items-center gap-1.5 font-heading text-lg font-semibold capitalize"
          dir="auto"
        >
          {fmt.monthYear.format(titleDate)}
          <CalendarDays className={cn("size-4", monthOpen ? "text-primary" : "text-muted-foreground")} />
        </button>

        <div className="flex items-center gap-1">
          {selected !== today && (
            <button type="button" onClick={goToday} className="px-2 text-sm font-medium text-primary">
              {t("Today")}
            </button>
          )}
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={monthOpen ? t("Previous month") : t("Previous week")}
            className="grid size-9 place-content-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={monthOpen ? t("Next month") : t("Next week")}
            className="grid size-9 place-content-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-5 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {monthOpen ? (
        /* Full month calendar — jump to any date. */
        <div className="px-3 py-3">
          <div className="grid grid-cols-7">
            {monthGrid[0].map((d) => (
              <span key={d.getDay()} className="pb-1 text-center text-[11px] font-medium capitalize text-muted-foreground">
                {fmt.weekdayNarrow.format(d)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {monthGrid.flat().map((d) => {
              const iso = toISO(d);
              const isSel = iso === selected;
              const isToday = iso === today;
              const inMonth = d.getMonth() === monthCursor.getMonth();
              const isPast = iso < today;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(d)}
                  className={cn(
                    "mx-auto grid size-9 place-content-center rounded-full text-sm transition-colors",
                    isSel
                      ? "bg-primary font-semibold text-primary-foreground"
                      : cn(
                          "hover:bg-muted",
                          !inMonth && "text-muted-foreground/40",
                          inMonth && lockPast && isPast && "text-muted-foreground/60",
                          isToday && "font-bold text-primary ring-1 ring-primary/40"
                        )
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* One full week, Sunday to Saturday — the arrows page through weeks. */
        <div className="flex gap-1 px-3 py-3">{weekDays.map(dayChip)}</div>
      )}
    </div>
  );
}
