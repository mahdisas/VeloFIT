"use client";

import * as React from "react";
import { toast } from "sonner";
import { Clock, FileText, History, Loader2, Phone, RotateCcw, SendHorizontal, Trash2, UserPlus, Users } from "lucide-react";

import {
  deleteSingleSession,
  enrollClientInSession,
  getSessionRoster,
  searchEnrollableClients,
  setEnrollmentNote,
  setEnrollmentStatus,
  toggleAttendance,
  type RosterMember,
} from "@/app/(app)/classes/calendar/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { type CalendarSession, slashDate } from "@/lib/calendar";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * veloFIT attendance sheet (owner action). Opens from a class card and reuses
 * the same RLS-scoped server actions as the desktop calendar: search + add a
 * client, mark attendance, remove (→ rejected), and reinstate a rejected client.
 * Full-screen on phones, a contained bottom sheet on desktop.
 *
 * Past classes are view-only: you can record attendance and tidy the roster, but
 * not enroll (or reinstate) anyone — you can't book someone into a class that
 * already happened.
 */
export function ClassAttendanceSheet({
  session,
  date,
  isPast,
  open,
  onOpenChange,
  adjustEnrolled,
  onCanceled,
}: {
  session: CalendarSession | null;
  date: Date;
  isPast: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adjustEnrolled: (sessionId: string, delta: number) => void;
  onCanceled: (sessionId: string) => void;
}) {
  const t = useT();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex w-full flex-col gap-0 rounded-none p-0 data-[side=bottom]:h-dvh sm:mx-auto sm:max-w-lg sm:rounded-t-3xl sm:data-[side=bottom]:h-[90dvh]"
      >
        {session ? (
          <Body session={session} date={date} isPast={isPast} adjustEnrolled={adjustEnrolled} onCanceled={onCanceled} />
        ) : (
          <SheetHeader>
            <SheetTitle>{t("Class")}</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({
  session,
  date,
  isPast,
  adjustEnrolled,
  onCanceled,
}: {
  session: CalendarSession;
  date: Date;
  isPast: boolean;
  adjustEnrolled: (sessionId: string, delta: number) => void;
  onCanceled: (sessionId: string) => void;
}) {
  const t = useT();
  const [roster, setRoster] = React.useState<RosterMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  // Cancel-class is the only whole-sheet operation; everything else is per-row.
  const [pending, startTransition] = React.useTransition();

  // Per-row in-flight tracking. A shared useTransition made ONE toggle disable
  // every checkbox (and React 19 queues async transitions sequentially), so the
  // front desk couldn't mark the next client until the previous round trip
  // finished. Each row now locks only itself; different rows run in parallel.
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());
  const setBusy = (id: string, on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  // Optimistic enrolls carry a temp id until the server returns the real one —
  // their row controls must stay locked (the server doesn't know the temp id).
  const rowBusy = (id: string) => busyIds.has(id) || id.startsWith("temp-");

  // Load the live roster whenever the opened session changes.
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    getSessionRoster(session.id)
      .then((r) => active && setRoster(r))
      .catch(() => active && toast.error(t("Failed to load the roster.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const enrolled = roster.filter((m) => m.status === "booked" || m.status === "attended");
  const rejected = roster.filter((m) => m.status === "canceled" || m.status === "no_show");
  // Any client already on the roster (any status) can't be re-inserted (unique row).
  const excludeIds = React.useMemo(() => roster.map((m) => m.clientId), [roster]);

  /** Add a client — optimistic, reverted if the action fails. */
  const handleEnroll = (client: { id: string; name: string }) => {
    const temp: RosterMember = {
      enrollmentId: `temp-${client.id}-${Date.now()}`,
      clientId: client.id,
      name: client.name,
      status: "booked",
    };
    setRoster((prev) => [...prev, temp]);
    adjustEnrolled(session.id, +1);

    void (async () => {
      const result = await enrollClientInSession(session.id, client.id);
      if (!result.success) {
        setRoster((prev) => prev.filter((m) => m.enrollmentId !== temp.enrollmentId));
        adjustEnrolled(session.id, -1);
        toast.error(result.message);
        return;
      }
      setRoster((prev) => prev.map((m) => (m.enrollmentId === temp.enrollmentId ? result.member : m)));
      toast.success(t("{name} added", { name: client.name }));
    })();
  };

  /** Remove an enrollment — optimistic move to rejected (canceled), − the count. */
  const handleRemove = (member: RosterMember) => {
    const previous = member.status;
    setBusy(member.enrollmentId, true);
    setRoster((prev) =>
      prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: "canceled" } : m))
    );
    adjustEnrolled(session.id, -1);

    void (async () => {
      const result = await setEnrollmentStatus(member.enrollmentId, "canceled");
      if (!result.success) {
        setRoster((prev) =>
          prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: previous } : m))
        );
        adjustEnrolled(session.id, +1);
        toast.error(result.message);
      } else {
        toast.success(t("{name} removed", { name: member.name }));
      }
      setBusy(member.enrollmentId, false);
    })();
  };

  /** Reinstate a rejected client back to the enrolled list (passes the capacity trigger). */
  const handleReinstate = (member: RosterMember) => {
    const previous = member.status;
    setBusy(member.enrollmentId, true);
    setRoster((prev) =>
      prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: "booked" } : m))
    );
    adjustEnrolled(session.id, +1);

    void (async () => {
      const result = await setEnrollmentStatus(member.enrollmentId, "booked");
      if (!result.success) {
        setRoster((prev) =>
          prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: previous } : m))
        );
        adjustEnrolled(session.id, -1);
        toast.error(result.message); // can be SESSION_FULL
      } else {
        toast.success(t("{name} approved", { name: member.name }));
      }
      setBusy(member.enrollmentId, false);
    })();
  };

  /** Mark attended / not — optimistic; doesn't change the enrolled count. */
  const handleToggleAttendance = (member: RosterMember, attending: boolean) => {
    const previous = member.status;
    setBusy(member.enrollmentId, true);
    setRoster((prev) =>
      prev.map((m) =>
        m.enrollmentId === member.enrollmentId ? { ...m, status: attending ? "attended" : "booked" } : m
      )
    );
    void (async () => {
      const result = await toggleAttendance(member.enrollmentId, attending);
      if (!result.success) {
        setRoster((prev) =>
          prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: previous } : m))
        );
        toast.error(result.message);
      }
      setBusy(member.enrollmentId, false);
    })();
  };

  /** Persist a per-trainee note — optimistic, reverted if the action fails. */
  const handleSaveNote = (member: RosterMember, note: string) => {
    const previous = member.note ?? "";
    if (note === previous) return;
    setBusy(member.enrollmentId, true);
    setRoster((prev) => prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, note } : m)));

    void (async () => {
      const result = await setEnrollmentNote(member.enrollmentId, note);
      if (!result.success) {
        setRoster((prev) => prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, note: previous } : m)));
        toast.error(result.message);
      } else {
        toast.success(t("Note saved"));
      }
      setBusy(member.enrollmentId, false);
    })();
  };

  /** Cancel this single session (owner) — drops it from the calendar; roster kept. */
  const handleCancelClass = () =>
    startTransition(async () => {
      const result = await deleteSingleSession(session.id);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(t("Session canceled"));
      onCanceled(session.id);
    });

  return (
    <>
      {/* Grab handle + header */}
      <div className="shrink-0 px-5 pt-2">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="gap-1 p-0">
          <SheetTitle className="text-lg">
            <span dir="auto">{session.name}</span>
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{slashDate(date)}</span>
            <span className="inline-flex items-center gap-1" dir="ltr">
              <Clock className="size-3.5" /> {session.from}–{session.to}
            </span>
            {isPast && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <History className="size-3" /> {t("Past class")}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>
      </div>

      {/* Scrollable content */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-8 pt-4">
        {/* Enrolling a past class is allowed (back-fill attendance) — the header
            "Past class" badge is the only difference from a live class. */}
        <AddClientBox excludeIds={excludeIds} onPick={handleEnroll} disabled={loading} />

        {/* Enrolled list */}
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4 text-primary" />
            {t("Enrolled ({n})", { n: enrolled.length })}
          </h3>

          {loading ? (
            <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t("Loading…")}
            </div>
          ) : enrolled.length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              {t("No one is enrolled yet. Search above to add a client.")}
            </p>
          ) : (
            enrolled.map((m) => (
              <div key={m.enrollmentId} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                <Checkbox
                  checked={m.status === "attended"}
                  disabled={rowBusy(m.enrollmentId)}
                  onCheckedChange={(v) => handleToggleAttendance(m, v === true)}
                  aria-label={t("Mark {name} as attended", { name: m.name })}
                  className="size-5"
                />
                <span className="min-w-0 flex-1 truncate text-sm" dir="auto">{m.name}</span>
                {/* Tap-to-call — the front desk chases no-shows from the roster. */}
                {m.phone && (
                  <a
                    href={`tel:${m.phone.replace(/[^\d+]/g, "")}`}
                    aria-label={t("Call {name}", { name: m.name })}
                    className="grid size-8 shrink-0 place-content-center rounded-lg text-primary transition-colors hover:bg-primary/10"
                  >
                    <Phone className="size-4" />
                  </a>
                )}
                {m.status === "attended" && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {t("Attended")}
                  </span>
                )}
                <NoteButton note={m.note ?? ""} onSave={(n) => handleSaveNote(m, n)} disabled={rowBusy(m.enrollmentId)} />
                <button
                  type="button"
                  aria-label={t("Remove {name}", { name: m.name })}
                  onClick={() => handleRemove(m)}
                  disabled={rowBusy(m.enrollmentId)}
                  className="grid size-8 shrink-0 place-content-center rounded-lg text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </section>

        {/* Rejected list (removed clients) */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("Rejected ({n})", { n: rejected.length })}</h3>
          {loading ? null : rejected.length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              {t("No removed clients.")}
            </p>
          ) : (
            rejected.map((m) => (
              <div key={m.enrollmentId} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through" dir="auto">
                  {m.name}
                </span>
                <button
                  type="button"
                  aria-label={t("Approve {name}", { name: m.name })}
                  onClick={() => handleReinstate(m)}
                  disabled={rowBusy(m.enrollmentId)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  <RotateCcw className="size-3.5" /> {t("Approve")}
                </button>
              </div>
            ))
          )}
        </section>

        {/* Waitlist — UI only for a future phase (قائمة الانتظار). */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("Waitlist")}</h3>
          <div className="flex min-h-20 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-3 py-5 text-center">
            <p className="text-sm text-muted-foreground">{t("The waitlist is empty.")}</p>
          </div>
        </section>

        {/* Cancel the class (future sessions only) — confirmed before it runs. */}
        {!isPast && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                className="mt-2 w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" /> {t("Cancel class")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("Cancel this session?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("This occurrence will be canceled and removed from the calendar. Its roster is kept for history.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Keep")}</AlertDialogCancel>
                <AlertDialogAction className={cn(buttonVariants({ variant: "destructive" }))} onClick={handleCancelClass}>
                  {t("Cancel session")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </>
  );
}

/** Per-trainee "Notes" button → a dialog with a textarea; persists via onSave
 *  (class_enrollments.notes) and re-seeds from the latest saved note on open. */
function NoteButton({
  note,
  onSave,
  disabled,
}: {
  note: string;
  onSave: (note: string) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(note);
  const hasNote = note.trim().length > 0;

  return (
    <>
      <button
        type="button"
        aria-label={hasNote ? t("Edit note") : t("Add note")}
        onClick={() => {
          setValue(note);
          setOpen(true);
        }}
        disabled={disabled}
        className={cn(
          "grid size-8 shrink-0 place-content-center rounded-lg transition-colors disabled:opacity-50",
          hasNote ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"
        )}
      >
        <FileText className="size-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Notes")}</DialogTitle>
          </DialogHeader>
          <Textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} rows={5} dir="auto" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("Close")}</Button>
            <Button
              type="button"
              onClick={() => {
                onSave(value);
                setOpen(false);
              }}
            >
              {t("Save")} <SendHorizontal className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Debounced "add a client" search over the gym's active clients. */
function AddClientBox({
  excludeIds,
  onPick,
  disabled,
}: {
  excludeIds: string[];
  onPick: (client: { id: string; name: string }) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await searchEnrollableClients(query);
        if (active) setResults(res.filter((r) => !excludeIds.includes(r.id)));
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query, open, excludeIds]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("Add a client")}
        className="h-11 pe-9"
        disabled={disabled}
      />
      <UserPlus className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-primary" />

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
          {searching ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">{t("Searching…")}</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">{t("No clients found.")}</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onPick(c);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-accent"
              >
                <UserPlus className="size-3.5 shrink-0 text-muted-foreground" />
                <span dir="auto" className="truncate">{c.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
