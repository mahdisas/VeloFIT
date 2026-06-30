"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Clock, Dumbbell, Hourglass, Loader2, MapPin, User } from "lucide-react";

import {
  cancelReservation,
  getMemberClassDetail,
  reserveSpot,
  type MemberClassDetail,
} from "@/app/app/booking-actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fromISO } from "@/lib/calendar";
import { vibrantColor } from "@/lib/mobile";
import { useLocale, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Member class detail + booking sheet. Shows the class info and (only when the
 * class allows it) the participant roster, plus an action button that flows
 * Reserve → Join Waiting List (when full + allowed) → Class full, and
 * Cancel/Leave when already enrolled. All writes go through the member proxy.
 */
export function MemberClassSheet({
  sessionId,
  open,
  onOpenChange,
  onChanged,
}: {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const t = useT();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex w-full flex-col gap-0 rounded-none p-0 data-[side=bottom]:h-dvh sm:mx-auto sm:max-w-lg sm:rounded-t-3xl sm:data-[side=bottom]:h-auto sm:data-[side=bottom]:max-h-[90dvh]"
      >
        {sessionId ? (
          <Body key={sessionId} sessionId={sessionId} onChanged={onChanged} />
        ) : (
          <SheetHeader className="p-5">
            <SheetTitle>{t("Class")}</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

const ERR: Record<string, string> = {
  FULL: "This session is full.",
  NOT_ALLOWED: "This class isn't available for your subscription.",
  ALREADY: "You're already enrolled.",
  PAST: "This class has already ended.",
  ERROR: "Something went wrong. Please try again.",
};

function Body({ sessionId, onChanged }: { sessionId: string; onChanged?: () => void }) {
  const t = useT();
  const [detail, setDetail] = React.useState<MemberClassDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let active = true;
    getMemberClassDetail(sessionId).then((d) => {
      if (!active) return;
      if (d) setDetail(d);
      else setNotFound(true);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const refetch = () => {
    setLoading(true);
    getMemberClassDetail(sessionId).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  };

  const reserve = () =>
    startTransition(async () => {
      const res = await reserveSpot(sessionId);
      if (!res.ok) {
        toast.error(t(ERR[res.error] ?? ERR.ERROR));
        return;
      }
      toast.success(res.status === "booked" ? t("Spot reserved") : t("Added to the waiting list"));
      onChanged?.();
      refetch();
    });

  const cancel = () =>
    startTransition(async () => {
      const res = await cancelReservation(sessionId);
      if (!res.ok) {
        toast.error(t(ERR.ERROR));
        return;
      }
      toast.success(t("Reservation canceled"));
      onChanged?.();
      refetch();
    });

  if (loading && !detail) {
    return (
      <>
        {/* A title must always exist for screen readers, even while loading. */}
        <SheetHeader className="p-5">
          <SheetTitle>{t("Class")}</SheetTitle>
          <SheetDescription className="sr-only">{t("Loading…")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </>
    );
  }
  if (notFound || !detail) {
    return (
      <SheetHeader className="p-6">
        <SheetTitle>{t("Class")}</SheetTitle>
        <SheetDescription>{t("This class isn't available for your subscription.")}</SheetDescription>
      </SheetHeader>
    );
  }

  return <ClassDetailView detail={detail} pending={pending} onReserve={reserve} onCancel={cancel} />;
}

/** Presentational class detail (header + 3-card grid + participants + action). */
export function ClassDetailView({
  detail: d,
  pending,
  onReserve,
  onCancel,
}: {
  detail: MemberClassDetail;
  pending: boolean;
  onReserve: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const dateFmt = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const enrolled = d.myStatus === "booked" || d.myStatus === "attended";
  const waitlisted = d.myStatus === "waitlisted";
  const full = d.enrolled >= d.capacity;

  return (
    <>
      {/* Header — big centered colorful icon, name + category beneath */}
      <div className="shrink-0 px-5 pt-2">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="items-center gap-2 space-y-0 p-0 text-center">
          <span
            className="grid size-20 place-content-center rounded-[1.4rem] text-white shadow-md"
            style={{ backgroundColor: vibrantColor(d.color) }}
          >
            <Dumbbell className="size-9" />
          </span>
          <SheetTitle className="mt-1 text-xl"><span dir="auto">{d.name}</span></SheetTitle>
          <SheetDescription className="capitalize">
            {[d.kindName, dateFmt.format(fromISO(d.date))].filter(Boolean).join(" · ")}
          </SheetDescription>
        </SheetHeader>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-6 pt-5">
        {/* Three uniform info widgets */}
        <div className="grid grid-cols-3 gap-3">
          <InfoCard icon={<User className="size-5" />} label={t("Trainer")} value={d.trainerName || "—"} />
          <InfoCard icon={<Clock className="size-5" />} label={t("Time")} value={`${d.from}–${d.to}`} />
          <InfoCard icon={<MapPin className="size-5" />} label={t("Location")} value={d.locationName || "—"} />
        </div>

        {/* Participants — the counter (show_max_participants) and/or the roster
            names (show_enroll_list); each is gated independently by its setting. */}
        {(d.showCount || (d.showRoster && d.roster)) && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("Participants")}</h3>
              {d.showCount && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                  {d.enrolled}/{d.capacity}
                </span>
              )}
            </div>
            {d.showRoster && d.roster && (
              d.roster.length === 0 ? (
                <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  {t("No one is enrolled yet.")}
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border bg-card">
                  {d.roster.map((m, i) => (
                    <div key={i} className={cn("flex items-center justify-between gap-2 px-3 py-2.5 text-sm", i > 0 && "border-t")}>
                      <span dir="auto" className="truncate">{m.name}</span>
                      {m.status === "waitlisted" && (
                        <span className="shrink-0 text-xs text-amber-600">{t("Waiting list")}</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </section>
        )}
      </div>

      {/* Large, full-width, rounded action — pinned with safe-area padding */}
      <div className="shrink-0 space-y-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {d.isPast ? (
          enrolled ? (
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-600">
              <Check className="size-4" /> {t("Attended")}
            </p>
          ) : (
            <Button type="button" className="h-12 w-full rounded-xl text-base" disabled>{t("This class has already ended.")}</Button>
          )
        ) : enrolled ? (
          <>
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-600">
              <Check className="size-4" /> {t("Reserved")}
            </p>
            <Button type="button" variant="outline" disabled={pending} onClick={onCancel} className="h-12 w-full rounded-xl text-base text-destructive hover:text-destructive">
              {t("Cancel reservation")}
            </Button>
          </>
        ) : waitlisted ? (
          <>
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-amber-600">
              <Hourglass className="size-4" /> {t("On the waiting list")}
            </p>
            <Button type="button" variant="outline" disabled={pending} onClick={onCancel} className="h-12 w-full rounded-xl text-base text-destructive hover:text-destructive">
              {t("Leave")}
            </Button>
          </>
        ) : !full ? (
          <Button type="button" className="h-12 w-full rounded-xl text-base" disabled={pending} onClick={onReserve}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} {t("Reserve a spot")}
          </Button>
        ) : d.allowWaitlist ? (
          <>
            <p className="text-center text-xs text-muted-foreground">{t("This session is full.")}</p>
            <Button type="button" variant="secondary" className="h-12 w-full rounded-xl text-base" disabled={pending} onClick={onReserve}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Hourglass className="size-4" />} {t("Join Waiting List")}
            </Button>
          </>
        ) : (
          <Button type="button" className="h-12 w-full rounded-xl text-base" disabled>{t("Class full")}</Button>
        )}
      </div>
    </>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border bg-muted/20 px-2 py-4 text-center">
      <span className="text-primary">{icon}</span>
      <span className="w-full truncate text-[13px] font-semibold leading-tight" dir="auto">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}
