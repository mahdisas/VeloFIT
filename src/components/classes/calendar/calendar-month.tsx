"use client";

import * as React from "react";
import { CirclePlus, X } from "lucide-react";

import { useCalendarSessions } from "@/components/classes/calendar/calendar-sessions-context";
import {
  type CalendarSession,
  filterSessions,
  isSameDay,
  longDateLabel,
  monthGridWeeks,
  SHORT_DAYS,
} from "@/lib/calendar";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 2;

export function CalendarMonth({
  cursor,
  today,
  kindFilter,
  showCanceled,
  onQuickAdd,
  onOpenDetail,
}: {
  cursor: Date;
  today: Date;
  kindFilter: string[] | "all";
  showCanceled: boolean;
  onQuickAdd: (date: Date) => void;
  onOpenDetail: (session: CalendarSession, date: Date) => void;
}) {
  const t = useT();
  const { sessionsForDate } = useCalendarSessions();
  const weeks = monthGridWeeks(cursor);
  const [moreDay, setMoreDay] = React.useState<string | null>(null);

  return (
    <div className="rounded-lg border">
      <div className="grid grid-cols-7 rounded-t-lg border-b bg-muted/40">
        {SHORT_DAYS.map((d) => (
          <div key={d} className="px-2 py-2.5 text-center text-sm font-semibold">{t(d)}</div>
        ))}
      </div>

      <div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((date) => {
              const iso = date.toISOString();
              const inMonth = date.getMonth() === cursor.getMonth();
              const sessions = inMonth ? filterSessions(sessionsForDate(date), kindFilter, showCanceled) : [];
              const visible = sessions.slice(0, MAX_VISIBLE);
              const extra = sessions.length - visible.length;
              return (
                <div key={iso} className={cn("relative min-h-28 border-r p-1.5 last:border-r-0", !inMonth && "bg-muted/50")}>
                  <div className="mb-1 flex items-center justify-between">
                    {/* Adjacent-month days are read-only: no quick-add affordance. */}
                    {inMonth ? (
                      <button type="button" aria-label="Add new class" title="Add new class" onClick={() => onQuickAdd(date)} className="text-muted-foreground transition-colors hover:text-primary">
                        <CirclePlus className="size-4" />
                      </button>
                    ) : (
                      <span />
                    )}
                    <span className={cn("text-sm", isSameDay(date, today) && inMonth ? "grid size-6 place-content-center rounded-full bg-primary font-semibold text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/35")}>
                      {date.getDate()}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {visible.map((s) => (
                      <MonthBlock key={s.id} session={s} onClick={() => onOpenDetail(s, date)} />
                    ))}
                    {extra > 0 && (
                      <button type="button" onClick={() => setMoreDay(iso)} className="px-1 text-start text-xs font-medium text-primary hover:underline">
                        +{extra} more
                      </button>
                    )}
                  </div>

                  {moreDay === iso && (
                    <MorePopover
                      date={date}
                      sessions={sessions}
                      onClose={() => setMoreDay(null)}
                      onOpenDetail={(s) => { setMoreDay(null); onOpenDetail(s, date); }}
                      onQuickAdd={() => { setMoreDay(null); onQuickAdd(date); }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthBlock({ session, onClick }: { session: CalendarSession; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="overflow-hidden rounded-md px-1.5 py-1 text-start text-[11px] leading-tight text-white transition-opacity hover:opacity-90"
      style={{ backgroundColor: session.color }}
    >
      <div className="truncate font-semibold">{session.from}-{session.to} ({session.enrolled}/{session.capacity})</div>
      <div className="truncate" dir="auto">{session.name}</div>
      <div className="truncate opacity-90" dir="auto">{session.trainer}</div>
    </button>
  );
}

/** "+X more" overlay: full class list for a single day (matches the veloFIT popover). */
function MorePopover({
  date,
  sessions,
  onClose,
  onOpenDetail,
  onQuickAdd,
}: {
  date: Date;
  sessions: CalendarSession[];
  onClose: () => void;
  onOpenDetail: (s: CalendarSession) => void;
  onQuickAdd: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-8 left-1 z-50 w-56 rounded-lg border bg-popover p-2 shadow-xl">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Add new class" onClick={onQuickAdd} className="text-muted-foreground hover:text-primary">
            <CirclePlus className="size-4" />
          </button>
          <span className="text-sm font-semibold">{longDateLabel(date)}</span>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
        {sessions.map((s) => (
          <MonthBlock key={s.id} session={s} onClick={() => onOpenDetail(s)} />
        ))}
      </div>
    </div>
  );
}
