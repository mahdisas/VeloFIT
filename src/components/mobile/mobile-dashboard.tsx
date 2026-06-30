"use client";

import * as React from "react";
import { Clock, TicketCheck, Users } from "lucide-react";

import { type MyClass } from "@/app/app/booking-actions";
import { SubscriptionCard } from "@/components/mobile/subscription-card";
import { fromISO } from "@/lib/calendar";
import { firstName, greetingKey, upcomingFrom, type DatedSession } from "@/lib/mobile";
import { type MobileSubscription } from "@/lib/mobile-server";
import { useLocale, useT } from "@/lib/i18n/provider";

/** Normalised shape for the "Next class" tile, from a session or an enrollment. */
type NextInfo = {
  name: string;
  color: string;
  date: string;
  from: string;
  to: string;
  trainer: string;
  enrolled: number;
  capacity: number;
  showCount: boolean;
};

/**
 * Home · Dashboard — a greeting, the next class that hasn't started yet, and the
 * viewer's memberships. Members see their own subscription cards; staff see a
 * gym-wide active count.
 */
export function MobileDashboard({
  name,
  sessions,
  activeSubscriptions,
  subscriptions = [],
  isMember = false,
  enrolledClasses = [],
}: {
  name: string;
  sessions: DatedSession[];
  activeSubscriptions: number;
  subscriptions?: MobileSubscription[];
  isMember?: boolean;
  /** Members only: their own enrolled classes — the "next class" tile uses these. */
  enrolledClasses?: MyClass[];
}) {
  const t = useT();
  const locale = useLocale();
  const now = React.useMemo(() => new Date(), []);
  const greeting = greetingKey(now);
  const fname = firstName(name);

  // Members see the next class they're ENROLLED in; staff see the gym's next.
  const next: NextInfo | null = React.useMemo(() => {
    if (isMember) {
      const c = upcomingFrom(enrolledClasses, now)[0];
      return c
        ? { name: c.name, color: c.color, date: c.date, from: c.from, to: c.to, trainer: c.trainerName, enrolled: c.enrolled, capacity: c.capacity, showCount: c.showCount }
        : null;
    }
    const s = upcomingFrom(sessions, now)[0];
    return s
      ? { name: s.name, color: s.color, date: s.date, from: s.from, to: s.to, trainer: s.trainer, enrolled: s.enrolled, capacity: s.capacity, showCount: true }
      : null;
  }, [isMember, enrolledClasses, sessions, now]);

  const fmtDay = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const fmtToday = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-5 p-4">
      <header>
        <h1 className="font-heading text-2xl font-bold" dir="auto">
          {t(greeting)}{fname ? `, ${fname}` : ""}
        </h1>
        <p className="text-sm capitalize text-muted-foreground">{fmtToday.format(now)}</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("Next class")}</h2>
        {next ? (
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-stretch gap-3">
              <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: next.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold" dir="auto">{next.name}</p>
                <p className="text-xs capitalize text-muted-foreground">{fmtDay.format(fromISO(next.date))}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5" dir="ltr"><Clock className="size-4" />{next.from}–{next.to}</span>
              {next.trainer && <span dir="auto" className="truncate">{next.trainer}</span>}
              {next.showCount && (
                <span className="inline-flex items-center gap-1.5"><Users className="size-4" />{next.enrolled}/{next.capacity}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("No upcoming classes")}
          </div>
        )}
      </section>

      {isMember ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t("Subscriptions")}</h2>
          {subscriptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("No active subscriptions")}
            </div>
          ) : (
            subscriptions.map((s) => <SubscriptionCard key={s.id} subscription={s} />)
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t("Active subscriptions")}</h2>
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
            <div className="grid size-12 shrink-0 place-content-center rounded-2xl bg-primary/10 text-primary">
              <TicketCheck className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none tabular-nums">{activeSubscriptions}</p>
              <p className="text-sm text-muted-foreground">{t("active memberships")}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
