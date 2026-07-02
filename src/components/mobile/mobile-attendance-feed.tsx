"use client";

import * as React from "react";
import { CalendarX2 } from "lucide-react";

import { type AttendanceEntry } from "@/app/(app)/classes/calendar/actions";
import { initials } from "@/lib/clients";
import { vibrantColor } from "@/lib/mobile";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * Owner · Activity — a clean feed of the gym's most recent check-ins, grouped by
 * day (Today / Yesterday / date). Replaces the old gym-wide past-class dump: it
 * answers "who just came in?" at a glance with the same card language as the rest
 * of the app.
 */
export function MobileAttendanceFeed({ entries }: { entries: AttendanceEntry[] }) {
  const t = useT();
  const locale = useLocale();

  const fmt = React.useMemo(
    () => ({
      time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }),
      day: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
      key: new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }),
    }),
    [locale]
  );

  const now = new Date();
  const todayKey = fmt.key.format(now);
  const yesterdayKey = fmt.key.format(new Date(now.getTime() - 86400000));

  // Group consecutive entries by local day (entries already arrive newest-first).
  const groups: { key: string; label: string; items: AttendanceEntry[] }[] = [];
  for (const e of entries) {
    const d = new Date(e.at);
    const key = fmt.key.format(d);
    const label = key === todayKey ? t("Today") : key === yesterdayKey ? t("Yesterday") : fmt.day.format(d);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(e);
    else groups.push({ key, label, items: [e] });
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center text-muted-foreground">
        <CalendarX2 className="size-8" />
        <p className="text-sm">{t("No recent activity")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2.5">
          <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" dir="auto">
            {g.label}
          </h2>
          {g.items.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
              <span
                className="grid size-12 shrink-0 place-content-center rounded-2xl text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: vibrantColor(e.color) }}
              >
                <span dir="auto">{initials(e.clientName)}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold leading-tight" dir="auto">{e.clientName}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground" dir="auto">
                  {e.className || t("Gym visit")}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground" dir="ltr">
                {fmt.time.format(new Date(e.at))}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
