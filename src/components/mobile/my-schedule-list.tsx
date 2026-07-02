"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarX2 } from "lucide-react";

import { type MyClass } from "@/app/app/booking-actions";
import { MemberClassSheet } from "@/components/mobile/member-class-sheet";
import { MobileClassCard } from "@/components/mobile/mobile-class-card";
import { fromISO } from "@/lib/calendar";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * A date-grouped list of the member's own bookings, rendered with the shared
 * MobileClassCard. Used by both Upcoming sub-tabs (Enrolled / Waiting List).
 */
export function MemberBookingList({ classes, emptyKey }: { classes: MyClass[]; emptyKey?: string }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(null);

  const dateFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
    [locale]
  );

  const groups: [string, MyClass[]][] = [];
  for (const c of classes) {
    const last = groups[groups.length - 1];
    if (last && last[0] === c.date) last[1].push(c);
    else groups.push([c.date, [c]]);
  }

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center text-muted-foreground">
        <CalendarX2 className="size-8" />
        <p className="text-sm">{t(emptyKey ?? "You're not enrolled in any upcoming classes yet.")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      {groups.map(([date, list]) => (
        <section key={date} className="flex flex-col gap-2.5">
          <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {dateFmt.format(fromISO(date))}
          </h2>
          {list.map((c) => (
            <MobileClassCard
              key={c.sessionId}
              name={c.name}
              color={c.color}
              from={c.from}
              to={c.to}
              trainerName={c.trainerName}
              enrolled={c.enrolled}
              capacity={c.capacity}
              showParticipants={c.showCount}
              onClick={() => setOpenId(c.sessionId)}
            />
          ))}
        </section>
      ))}

      <MemberClassSheet
        sessionId={openId}
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}
