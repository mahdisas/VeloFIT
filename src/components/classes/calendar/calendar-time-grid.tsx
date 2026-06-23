"use client";

import * as React from "react";
import { CirclePlus } from "lucide-react";

import { useCalendarSessions } from "@/components/classes/calendar/calendar-sessions-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type CalendarSession,
  filterSessions,
  HOURS,
  LONG_DAYS,
  SHORT_DAYS,
  toMinutes,
} from "@/lib/calendar";
import { useT } from "@/lib/i18n/provider";

const HOUR_H = 56; // px per hour row

type Placed = { session: CalendarSession; left: number; width: number; top: number; height: number };

/**
 * FullCalendar-style side-by-side layout for one day's sessions. Overlapping
 * events are packed into the fewest columns and each gets an equal-width slice,
 * so same-hour classes sit cleanly beside one another instead of stacking.
 */
function layoutDay(sessions: CalendarSession[]): Placed[] {
  const evs = sessions
    .map((s) => ({ s, start: toMinutes(s.from), end: toMinutes(s.to), col: 0 }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out: Placed[] = [];
  let group: typeof evs = [];
  let groupEnd = -1;

  const flush = (g: typeof evs) => {
    const colEnds: number[] = [];
    g.forEach((e) => {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= e.start) { e.col = c; colEnds[c] = e.end; placed = true; break; }
      }
      if (!placed) { e.col = colEnds.length; colEnds.push(e.end); }
    });
    const cols = colEnds.length;
    g.forEach((e) =>
      out.push({
        session: e.s,
        left: (e.col / cols) * 100,
        width: (1 / cols) * 100,
        top: (e.start / 60) * HOUR_H,
        height: ((e.end - e.start) / 60) * HOUR_H,
      })
    );
  };

  evs.forEach((e) => {
    if (group.length && e.start >= groupEnd) { flush(group); group = []; groupEnd = -1; }
    group.push(e);
    groupEnd = Math.max(groupEnd, e.end);
  });
  if (group.length) flush(group);
  return out;
}

export function CalendarTimeGrid({
  days,
  long,
  kindFilter,
  showCanceled,
  onQuickAdd,
  onOpenDetail,
}: {
  days: Date[];
  long: boolean; // true = Day view header (full name + dd/mm/yyyy)
  kindFilter: string[] | "all";
  showCanceled: boolean;
  onQuickAdd: (date: Date) => void;
  onOpenDetail: (session: CalendarSession, date: Date) => void;
}) {
  const t = useT();
  const { sessionsForDate } = useCalendarSessions();
  const header = (d: Date) => {
    const mi = (d.getDay() + 6) % 7;
    if (long) return `${t(LONG_DAYS[mi])} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    return `${t(SHORT_DAYS[mi])} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* header */}
      <div className="flex border-b bg-muted/40">
        <div className="w-16 shrink-0 border-r" />
        {days.map((d) => (
          <div key={d.toISOString()} className="flex flex-1 items-center justify-center gap-2 border-r py-2.5 text-sm font-semibold last:border-r-0">
            <button type="button" aria-label={t("Add new class")} title={t("Add new class")} onClick={() => onQuickAdd(d)} className="text-muted-foreground transition-colors hover:text-primary">
              <CirclePlus className="size-4" />
            </button>
            <span>{header(d)}</span>
          </div>
        ))}
      </div>

      {/* body */}
      <div className="flex">
        <div className="w-16 shrink-0 border-r">
          {HOURS.map((h) => (
            <div key={h} className="relative" style={{ height: HOUR_H }}>
              <span className="absolute -top-2 right-2 text-xs text-muted-foreground">{pad(h)}:00</span>
            </div>
          ))}
        </div>

        {days.map((d) => {
          const placed = layoutDay(filterSessions(sessionsForDate(d), kindFilter, showCanceled));
          return (
            <div key={d.toISOString()} className="relative flex-1 border-r last:border-r-0" style={{ height: HOURS.length * HOUR_H }}>
              {HOURS.map((h) => (
                <div key={h} className="absolute inset-x-0 border-b border-border/60" style={{ top: h * HOUR_H, height: HOUR_H }} />
              ))}
              {placed.map((p) => (
                <TimeBlock key={p.session.id} placed={p} onClick={() => onOpenDetail(p.session, d)} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeBlock({ placed, onClick }: { placed: Placed; onClick: () => void }) {
  const { session, left, width, top, height } = placed;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="absolute overflow-hidden rounded-md px-1.5 py-1 text-start text-[11px] leading-tight text-white ring-1 ring-white/50 transition-shadow hover:z-10 hover:shadow-lg"
          style={{
            left: `calc(${left}% + 2px)`,
            width: `calc(${width}% - 4px)`,
            top: top + 1,
            height: Math.max(0, height - 2),
            backgroundColor: session.color,
          }}
        >
          <div className="truncate font-semibold">{session.from}-{session.to} ({session.enrolled}/{session.capacity})</div>
          <div className="truncate" dir="auto">{session.name}</div>
          <div className="truncate opacity-90" dir="auto">{session.trainer}</div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: session.color }} />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">{session.from} - {session.to} ({session.enrolled}/{session.capacity})</span>
            <span dir="auto">{session.name}</span>
            <span className="opacity-80" dir="auto">{session.trainer}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
