"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { getMemberSessions } from "@/app/app/booking-actions";
import { MemberClassSheet } from "@/components/mobile/member-class-sheet";
import { MobileClassCard } from "@/components/mobile/mobile-class-card";
import { WeekDatePicker } from "@/components/mobile/week-date-picker";
import { addDays, toISO, type CalendarSessionMap } from "@/lib/calendar";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * Member Schedules — the same date-scroller as the owner's mobile schedule, but
 * the sessions are pre-filtered to the member's group classes (getMemberSessions),
 * and tapping a class opens the booking sheet (not the owner roster).
 */
export function MemberSchedule({ initialSessions }: { initialSessions: CalendarSessionMap }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const today = React.useMemo(() => toISO(new Date()), []);
  const [selected, setSelected] = React.useState(today);
  const [byDate, setByDate] = React.useState<CalendarSessionMap>(initialSessions);
  const [loaded, setLoaded] = React.useState<Set<string>>(() => {
    const set = new Set<string>();
    const now = new Date();
    for (let i = -2; i <= 2; i++) set.add(toISO(addDays(now, i)));
    return set;
  });
  const [loadingDate, setLoadingDate] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const fmt = React.useMemo(
    () => ({
      full: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
    }),
    [locale]
  );

  // Fetch a day the first time it's shown.
  React.useEffect(() => {
    if (loaded.has(selected)) return;
    let active = true;
    setLoadingDate(selected);
    getMemberSessions(selected, selected)
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

  // After a booking/cancel: refresh the selected day's counts here, and ask the
  // server to re-render the route so the sibling Dashboard tab's "next class"
  // (computed server-side from the member's enrollments) reflects the change too.
  const refreshSelected = React.useCallback(() => {
    getMemberSessions(selected, selected).then((map) =>
      setByDate((prev) => ({ ...prev, [selected]: map[selected] ?? [] }))
    );
    router.refresh();
  }, [selected, router]);

  const selectedDateObj = React.useMemo(() => {
    const [y, m, d] = selected.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selected]);

  const sessions = (byDate[selected] ?? [])
    .filter((s) => !s.canceled)
    .slice()
    .sort((a, b) => a.from.localeCompare(b.from));
  const isLoading = loadingDate === selected && !loaded.has(selected);

  return (
    <div className="flex min-h-full flex-col">
      {/* Sticky week-by-week date picker (arrows + fold-out month calendar). */}
      <WeekDatePicker selected={selected} onSelect={setSelected} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm font-medium capitalize text-muted-foreground" dir="auto">{fmt.full.format(selectedDateObj)}</p>

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
                showParticipants={s.showMaxParticipants}
                onClick={() => setOpenId(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      <MemberClassSheet
        sessionId={openId}
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        onChanged={refreshSelected}
      />
    </div>
  );
}
