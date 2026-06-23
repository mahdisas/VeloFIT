"use client";

import * as React from "react";
import { CirclePlus } from "lucide-react";

import { useCalendarSessions } from "@/components/classes/calendar/calendar-sessions-context";
import {
  type CalendarSession,
  filterSessions,
  LONG_DAYS,
  weekDates,
} from "@/lib/calendar";
import { useT } from "@/lib/i18n/provider";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function CalendarAgenda({
  cursor,
  kindFilter,
  showCanceled,
  onQuickAdd,
  onOpenDetail,
}: {
  cursor: Date;
  kindFilter: string[] | "all";
  showCanceled: boolean;
  onQuickAdd: (date: Date) => void;
  onOpenDetail: (session: CalendarSession, date: Date) => void;
}) {
  const t = useT();
  const { sessionsForDate } = useCalendarSessions();
  const days = weekDates(cursor)
    .map((d) => ({ date: d, sessions: filterSessions(sessionsForDate(d), kindFilter, showCanceled) }))
    .filter((g) => g.sessions.length > 0);

  if (days.length === 0) {
    return (
      <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">
        {t("No classes scheduled this week.")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {days.map(({ date, sessions }) => (
        <div key={date.toISOString()}>
          <div className="flex items-center justify-between border-y bg-muted/40 px-4 py-2.5 first:border-t-0">
            <div className="flex items-center gap-2">
              <button type="button" aria-label={t("Add new class")} title={t("Add new class")} onClick={() => onQuickAdd(date)} className="text-muted-foreground transition-colors hover:text-primary">
                <CirclePlus className="size-4" />
              </button>
              <span className="font-semibold">{t(LONG_DAYS[(date.getDay() + 6) % 7])}</span>
            </div>
            <span className="text-sm font-semibold">{date.getDate()} {t(MONTHS[date.getMonth()])} {date.getFullYear()}</span>
          </div>

          {sessions.map((s) => (
            <AgendaRow key={s.id} session={s} onClick={() => onOpenDetail(s, date)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function AgendaRow({ session, onClick }: { session: CalendarSession; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-4 border-b px-4 py-3 text-start transition-colors last:border-b-0 hover:bg-accent/50"
    >
      <div className="w-28 shrink-0 pt-0.5 text-sm text-muted-foreground">
        {session.from} - {session.to}
      </div>
      <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: session.color }} />
      <div className="min-w-0 text-sm">
        <div className="font-medium">{session.from}-{session.to} ({session.enrolled}/{session.capacity})</div>
        <div dir="auto">{session.name}</div>
        <div className="text-muted-foreground" dir="auto">{session.trainer}</div>
      </div>
    </button>
  );
}
