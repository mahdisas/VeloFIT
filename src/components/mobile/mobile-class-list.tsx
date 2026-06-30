"use client";

import * as React from "react";
import { CalendarX2, Lock, Users } from "lucide-react";

import { ClassAttendanceSheet } from "@/components/mobile/class-attendance-sheet";
import { fromISO } from "@/lib/calendar";
import { pastFrom, upcomingFrom, type DatedSession } from "@/lib/mobile";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * A grouped, tappable list of class occurrences. Tapping a card opens the shared
 * attendance sheet (manage upcoming, or view a past class). Used by the Upcoming
 * and History screens. `mode` filters by the client's local clock and makes the
 * sheet view-only for past classes.
 */
export function MobileClassList({
  sessions: initial,
  mode,
  emptyText,
  readonly = false,
}: {
  sessions: DatedSession[];
  mode: "upcoming" | "past";
  emptyText?: string;
  /** Members get a read-only schedule — no attendance sheet / roster. */
  readonly?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const past = mode === "past";
  // Filter by the client's local time on first render (the server can't know it).
  const [sessions, setSessions] = React.useState(() =>
    past ? pastFrom(initial) : upcomingFrom(initial)
  );
  const [open, setOpen] = React.useState<DatedSession | null>(null);

  const dateFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
    [locale]
  );

  const adjustEnrolled = (id: string, delta: number) =>
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, enrolled: Math.max(0, s.enrolled + delta) } : s)));
  const markCanceled = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setOpen(null);
  };

  // Group into [date, sessions] sections, preserving the incoming order.
  const groups: [string, DatedSession[]][] = [];
  for (const s of sessions) {
    const last = groups[groups.length - 1];
    if (last && last[0] === s.date) last[1].push(s);
    else groups.push([s.date, [s]]);
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center text-muted-foreground">
        <CalendarX2 className="size-8" />
        <p className="text-sm">{emptyText ?? t("No classes scheduled")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {groups.map(([date, list]) => (
        <section key={date} className="flex flex-col gap-2">
          <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {dateFmt.format(fromISO(date))}
          </h2>
          {list.map((s) => {
            const body = (
              <>
                <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium" dir="auto">{s.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground" dir="ltr">{s.from}–{s.to}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {s.trainer && <span dir="auto" className="truncate">{s.trainer}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" /> {s.enrolled}/{s.capacity}
                    </span>
                    {past && (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="size-3" /> {t("Past — view only")}
                      </span>
                    )}
                  </div>
                </div>
              </>
            );
            const cls = "flex items-stretch gap-3 rounded-2xl border bg-card p-3 text-start shadow-sm";
            return readonly ? (
              <div key={s.id} className={cls}>{body}</div>
            ) : (
              <button
                key={s.id}
                type="button"
                onClick={() => setOpen(s)}
                className={`${cls} transition-colors hover:border-primary/40 active:bg-muted/50`}
              >
                {body}
              </button>
            );
          })}
        </section>
      ))}

      {/* Owner-only roster/attendance — never shown to members (read-only). */}
      {!readonly && (
        <ClassAttendanceSheet
          session={open}
          date={open ? fromISO(open.date) : new Date()}
          isPast={past}
          open={open !== null}
          onOpenChange={(o) => !o && setOpen(null)}
          adjustEnrolled={adjustEnrolled}
          onCanceled={markCanceled}
        />
      )}
    </div>
  );
}
