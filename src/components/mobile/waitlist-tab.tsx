"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Hourglass, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { setEnrollmentStatus, type WaitlistEntry } from "@/app/(app)/classes/calendar/actions";
import { fromISO } from "@/lib/calendar";
import { initials } from "@/lib/clients";
import { vibrantColor } from "@/lib/mobile";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * Owner · Waiting List — every client waiting for a spot, with Approve (→ booked,
 * subject to the capacity trigger) and Reject (→ canceled). Members never see this;
 * the page only renders it for staff.
 */
export function WaitlistTab({ entries }: { entries: WaitlistEntry[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [list, setList] = React.useState(entries);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  // Re-seed when the server sends a fresh list (e.g. after a navigation/refresh).
  React.useEffect(() => setList(entries), [entries]);

  const dateFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }),
    [locale]
  );

  const act = (id: string, status: "booked" | "canceled") => {
    setPendingId(id);
    void (async () => {
      const res = await setEnrollmentStatus(id, status);
      if (!res.success) {
        toast.error(t(res.error === "SESSION_FULL" ? "This session is full." : "Something went wrong. Please try again."));
        setPendingId(null);
        return;
      }
      toast.success(status === "booked" ? t("Approved") : t("Rejected"));
      setList((prev) => prev.filter((e) => e.enrollmentId !== id));
      setPendingId(null);
      router.refresh();
    })();
  };

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center text-muted-foreground">
        <Hourglass className="size-8" />
        <p className="text-sm">{t("The waitlist is empty.")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {list.map((e) => {
        const busy = pendingId === e.enrollmentId;
        return (
          <div key={e.enrollmentId} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
            <span
              className="grid size-12 shrink-0 place-content-center rounded-2xl text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: vibrantColor(e.color) }}
            >
              <span dir="auto">{initials(e.clientName)}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold leading-tight" dir="auto">{e.clientName}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground" dir="auto">
                {e.className} · {dateFmt.format(fromISO(e.date))} · <span dir="ltr">{e.from}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {busy ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => act(e.enrollmentId, "booked")}
                    disabled={pendingId !== null}
                    aria-label={t("Approve")}
                    className="grid size-10 place-content-center rounded-full bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    <Check className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => act(e.enrollmentId, "canceled")}
                    disabled={pendingId !== null}
                    aria-label={t("Reject")}
                    className="grid size-10 place-content-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                  >
                    <X className="size-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
