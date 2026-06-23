"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, FileText, SendHorizontal, Trash2, UserPlus } from "lucide-react";

import {
  deleteAllSessions,
  deleteSingleSession,
  enrollClientInSession,
  getSessionRoster,
  searchEnrollableClients,
  setEnrollmentStatus,
  toggleAttendance,
  updateSession,
  type RosterMember,
} from "@/app/(app)/classes/calendar/actions";
import { useCalendarSessions } from "@/components/classes/calendar/calendar-sessions-context";
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
import { TimeField } from "@/components/ui/time-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { addOneHour, type CalendarSession, slashDate } from "@/lib/calendar";
import { type IdName } from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Detailed view for one scheduled session: editable time/trainer/limits (still
 * UI-only) plus the live trainee roster split into Approved / Waiting / Rejected.
 * The roster reads real class_enrollments; enrolling/removing call server actions
 * and optimistically update both this dialog and the calendar grid's count.
 */

export function ClassDetailDialog({
  open,
  onOpenChange,
  session,
  date,
  trainers,
  classKinds,
  locations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CalendarSession | null;
  date: Date | null;
  trainers: IdName[];
  classKinds: IdName[];
  locations: IdName[];
}) {
  if (!session || !date) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl data-[side=right]:lg:max-w-5xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <span dir="auto">{session.name}</span>
            <span className="text-sm font-normal text-muted-foreground">{slashDate(date)}</span>
          </SheetTitle>
        </SheetHeader>
        <DetailBody session={session} date={date} trainers={trainers} classKinds={classKinds} locations={locations} onOpenChange={onOpenChange} />
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({
  session,
  date,
  trainers,
  classKinds,
  locations,
  onOpenChange,
}: {
  session: CalendarSession;
  date: Date;
  trainers: IdName[];
  classKinds: IdName[];
  locations: IdName[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const { adjustEnrolled, removeSession, removeSessionsByClass, moveSession } = useCalendarSessions();

  // Editable session fields, pre-filled from this session.
  const [sessionDate, setSessionDate] = React.useState(toInputDate(date));
  const [from, setFrom] = React.useState(session.from);
  const [to, setTo] = React.useState(session.to);
  const [trainerId, setTrainerId] = React.useState(session.trainerId ?? "");
  const [minP, setMinP] = React.useState(Math.max(0, session.capacity - 2));
  const [maxP, setMaxP] = React.useState(session.capacity);
  const [kindId, setKindId] = React.useState(session.kindId);
  const [locationId, setLocationId] = React.useState(session.locationId ?? "");
  const [notes, setNotes] = React.useState(session.notes ?? "");
  const [autoEnroll, setAutoEnroll] = React.useState(false);

  // Session-level CRUD (Save / Delete). Separate from the roster transition.
  const [crudPending, startCrud] = React.useTransition();
  const [busyAction, setBusyAction] = React.useState<"save" | "deleteOne" | "deleteAll" | null>(null);

  const run = (action: "save" | "deleteOne" | "deleteAll", fn: () => Promise<void>) => {
    setBusyAction(action);
    startCrud(async () => {
      try {
        await fn();
      } finally {
        setBusyAction(null);
      }
    });
  };

  const handleSave = () =>
    run("save", async () => {
      const result = await updateSession(session.id, {
        classId: session.classId,
        sessionDate,
        startTime: from,
        endTime: to,
        trainerId: trainerId || null,
        capacity: maxP,
        kindId,
        locationId: locationId || null,
        notes,
      });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      const trainerName = trainers.find((t) => t.id === trainerId)?.name ?? "";
      moveSession(session.id, sessionDate, {
        from,
        to,
        capacity: maxP,
        trainer: trainerName,
        trainerId: trainerId || null,
        kindId,
        locationId: locationId || null,
        notes,
      });
      toast.success(t("Session updated"));
      onOpenChange(false);
    });

  const handleDeleteOne = () =>
    run("deleteOne", async () => {
      const result = await deleteSingleSession(session.id);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      removeSession(session.id);
      toast.success(t("Session canceled"));
      onOpenChange(false);
    });

  const handleDeleteAll = () =>
    run("deleteAll", async () => {
      const result = await deleteAllSessions(session.classId);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      removeSessionsByClass(session.classId, today);
      toast.success(t("Class stood down — upcoming sessions canceled"));
      onOpenChange(false);
    });

  // Live roster (real class_enrollments).
  const [roster, setRoster] = React.useState<RosterMember[]>([]);
  const [loadingRoster, setLoadingRoster] = React.useState(true);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let active = true;
    setLoadingRoster(true);
    getSessionRoster(session.id)
      .then((r) => active && setRoster(r))
      .catch(() => active && toast.error(t("Failed to load the roster.")))
      .finally(() => active && setLoadingRoster(false));
    return () => {
      active = false;
    };
  }, [session.id]);

  const approved = roster.filter((m) => m.status === "booked" || m.status === "attended");
  const waiting = roster.filter((m) => m.status === "waitlisted");
  const rejected = roster.filter((m) => m.status === "canceled" || m.status === "no_show");
  // A client already on the roster (any status) can't be re-inserted (unique row).
  const excludeIds = React.useMemo(() => roster.map((m) => m.clientId), [roster]);

  // Smart time: choosing a "From" snaps "To" to exactly one hour later.
  const onFromChange = (v: string) => {
    setFrom(v);
    if (v) setTo(addOneHour(v));
  };

  /** Enroll a client — optimistic add (+ grid count), reverted if the action fails. */
  const handleEnroll = (client: { id: string; name: string }) => {
    const temp: RosterMember = {
      enrollmentId: `temp-${client.id}-${Date.now()}`,
      clientId: client.id,
      name: client.name,
      status: "booked",
    };
    setRoster((prev) => [...prev, temp]);
    adjustEnrolled(session.id, +1);

    startTransition(async () => {
      const result = await enrollClientInSession(session.id, client.id);
      if (!result.success) {
        setRoster((prev) => prev.filter((m) => m.enrollmentId !== temp.enrollmentId));
        adjustEnrolled(session.id, -1);
        toast.error(result.message); // e.g. "This session has reached its maximum capacity."
        return;
      }
      // Swap the temp row for the persisted one (real enrollmentId).
      setRoster((prev) => prev.map((m) => (m.enrollmentId === temp.enrollmentId ? result.member : m)));
      toast.success(t("{name} enrolled", { name: client.name }));
    });
  };

  /** Cancel an enrollment — optimistic move to Rejected (− grid count). */
  const handleRemove = (member: RosterMember) => {
    const previous = member.status;
    setRoster((prev) => prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: "canceled" } : m)));
    adjustEnrolled(session.id, -1);

    startTransition(async () => {
      const result = await setEnrollmentStatus(member.enrollmentId, "canceled");
      if (!result.success) {
        setRoster((prev) => prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: previous } : m)));
        adjustEnrolled(session.id, +1);
        toast.error(result.message);
        return;
      }
      toast.success(t("{name} removed", { name: member.name }));
    });
  };

  /** Approve / promote back to booked — passes through the capacity trigger. */
  const handleReinstate = (member: RosterMember) => {
    const previous = member.status;
    setRoster((prev) => prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: "booked" } : m)));
    adjustEnrolled(session.id, +1);

    startTransition(async () => {
      const result = await setEnrollmentStatus(member.enrollmentId, "booked");
      if (!result.success) {
        setRoster((prev) => prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: previous } : m)));
        adjustEnrolled(session.id, -1);
        toast.error(result.message); // can be SESSION_FULL on re-booking
        return;
      }
      toast.success(t("{name} approved", { name: member.name }));
    });
  };

  /** Mark attended / not attended — optimistic; doesn't change the enrolled count. */
  const handleToggleAttendance = (member: RosterMember, attending: boolean) => {
    const previous = member.status;
    setRoster((prev) =>
      prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: attending ? "attended" : "booked" } : m))
    );
    startTransition(async () => {
      const result = await toggleAttendance(member.enrollmentId, attending);
      if (!result.success) {
        setRoster((prev) => prev.map((m) => (m.enrollmentId === member.enrollmentId ? { ...m, status: previous } : m)));
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        {/* editable fields */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field label={t("Date")}><Input type="date" value={sessionDate} onChange={(e) => e.target.value && setSessionDate(e.target.value)} /></Field>
          <Field label={t("From Hour")}><TimeField value={from} onChange={onFromChange} /></Field>
          <Field label={t("To Hour")}><TimeField value={to} onChange={setTo} /></Field>
          <Field label={t("Trainer")}>
            <SelectField value={trainerId} onChange={setTrainerId} options={trainers} placeholder={t("Select trainer")} emptyHint={t("No trainers yet — add one in Settings · Users.")} />
          </Field>
          <Field label={t("Min Participants")}><Input type="number" min={0} value={minP} onChange={(e) => setMinP(Number(e.target.value) || 0)} /></Field>
          <Field label={t("Max Participants")}><Input type="number" min={0} value={maxP} onChange={(e) => setMaxP(Number(e.target.value) || 0)} /></Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("Class Kind")}>
            <SelectField value={kindId} onChange={setKindId} options={classKinds} placeholder={t("Select class kind")} emptyHint={t("No class kinds yet.")} />
          </Field>
          <Field label={t("Location")}>
            <SelectField value={locationId} onChange={setLocationId} options={locations} placeholder={t("Select location")} emptyHint={t("No locations yet — add one in Settings · Locations.")} />
          </Field>
          <Field label={t("Notes")}><Input value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" /></Field>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={crudPending}>
            {busyAction === "save" ? t("Saving…") : t("Save")} <SendHorizontal className="size-4" />
          </Button>
        </div>

        <div className="border-t" />

        <label className="flex items-center gap-3 text-sm text-[#595959]">
          {t("Enroll client automatically")}
          <Switch checked={autoEnroll} onCheckedChange={setAutoEnroll} />
        </label>

        {/* trainee roster (live) */}
        <div className="grid gap-4 lg:grid-cols-3">
          <RosterColumn title={t("Approved trainees ({n})", { n: approved.length })}>
            <AddTraineeBox excludeIds={excludeIds} onPick={handleEnroll} disabled={pending || loadingRoster} />
            {loadingRoster ? (
              <Hint text={t("Loading roster…")} />
            ) : approved.length === 0 ? (
              <Hint text={t("No approved trainees.")} />
            ) : (
              approved.map((m) => (
                <TraineeItem
                  key={m.enrollmentId}
                  name={m.name}
                  disabled={pending}
                  attended={m.status === "attended"}
                  onToggleAttendance={(a) => handleToggleAttendance(m, a)}
                  onRemove={() => handleRemove(m)}
                />
              ))
            )}
          </RosterColumn>

          <RosterColumn title={t("Waiting trainees ({n})", { n: waiting.length })}>
            {loadingRoster ? (
              <Hint text={t("Loading…")} />
            ) : waiting.length === 0 ? (
              <Hint text={t("No waiting trainees.")} />
            ) : (
              waiting.map((m) => (
                <TraineeItem key={m.enrollmentId} name={m.name} disabled={pending} onApprove={() => handleReinstate(m)} />
              ))
            )}
          </RosterColumn>

          <RosterColumn title={t("Rejected trainees ({n})", { n: rejected.length })}>
            {loadingRoster ? (
              <Hint text={t("Loading…")} />
            ) : rejected.length === 0 ? (
              <Hint text={t("No rejected trainees.")} />
            ) : (
              rejected.map((m) => (
                <TraineeItem key={m.enrollmentId} name={m.name} disabled={pending} onApprove={() => handleReinstate(m)} />
              ))
            )}
          </RosterColumn>
        </div>
      </div>

      {/* footer */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t px-6 py-4">
        <div className="flex gap-2">
          <ConfirmDelete
            label={t("Delete Class")}
            loading={busyAction === "deleteOne"}
            disabled={crudPending}
            title={t("Cancel this session?")}
            description={t("This occurrence will be canceled and removed from the calendar. Its roster is kept for history.")}
            confirmLabel={t("Cancel session")}
            onConfirm={handleDeleteOne}
          />
          <ConfirmDelete
            label={t("Delete All Classes")}
            loading={busyAction === "deleteAll"}
            disabled={crudPending}
            title={t("Stand down the whole class?")}
            description={t("The class is deactivated and every upcoming session is canceled. Past sessions and their attendance are kept.")}
            confirmLabel={t("Cancel all upcoming")}
            onConfirm={handleDeleteAll}
          />
        </div>
        <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onOpenChange(false)}>
          {t("Cancel")}
        </Button>
      </div>
    </div>
  );
}

/** Searchable "Add a trainee" picker — enrolls the chosen client. */
function AddTraineeBox({
  excludeIds,
  onPick,
  disabled,
}: {
  excludeIds: string[];
  onPick: (client: { id: string; name: string }) => void;
  disabled?: boolean;
}) {
  const tr = useT();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Debounced search against the gym's active clients (excludes already-enrolled).
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
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
      clearTimeout(t);
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
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={tr("Add a trainee")}
        className="pe-9"
        dir="auto"
        disabled={disabled}
      />
      <UserPlus className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-primary" />

      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
          {searching ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">{tr("Searching…")}</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">{tr("No clients found.")}</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onPick(c); setQuery(""); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm hover:bg-accent"
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

function RosterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h4 className="font-semibold">{title}</h4>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <p className="px-1 py-2 text-sm text-muted-foreground">{text}</p>;
}

/** Destructive button guarded by a confirmation dialog. */
function ConfirmDelete({
  label,
  loading,
  disabled,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={disabled}>
          <Trash2 className="size-4" /> {loading ? t("Working…") : label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Keep")}</AlertDialogCancel>
          <AlertDialogAction className={cn(buttonVariants({ variant: "destructive" }))} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * One trainee row. The file icon is a real "Add note" button (not decoration):
 * clicking it opens a small note popup. Note persistence is mocked (toast) —
 * the external enrolment app owns it.
 */
function TraineeItem({
  name,
  attended,
  onToggleAttendance,
  onRemove,
  onApprove,
  disabled,
}: {
  name: string;
  attended?: boolean;
  onToggleAttendance?: (attending: boolean) => void;
  onRemove?: () => void;
  onApprove?: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      {onToggleAttendance && (
        <Checkbox
          checked={!!attended}
          disabled={disabled}
          onCheckedChange={(v) => onToggleAttendance(v === true)}
          aria-label={t("Mark {name} as attended", { name })}
          title={t("Attended")}
        />
      )}
      <span className="min-w-0 flex-1 truncate text-primary" dir="auto">{name}</span>
      <NoteButton />
      {onRemove && (
        <button type="button" aria-label={t("Remove trainee")} onClick={onRemove} disabled={disabled} className="shrink-0 text-destructive disabled:opacity-50">
          <Trash2 className="size-4" />
        </button>
      )}
      {onApprove && (
        <button type="button" aria-label={t("Approve trainee")} onClick={onApprove} disabled={disabled} className="shrink-0 text-primary disabled:opacity-50">
          <Check className="size-4" />
        </button>
      )}
    </div>
  );
}

/** "Add note" button → a centered "Notes" modal with a textarea + Close/Save. */
function NoteButton() {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  return (
    <>
      <button
        type="button"
        aria-label={t("Add note")}
        title={t("Add note")}
        onClick={() => setOpen(true)}
        className="shrink-0 text-primary transition-colors hover:text-primary/70"
      >
        <FileText className="size-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Notes")}</DialogTitle>
          </DialogHeader>
          <Textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={5} dir="auto" />
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setOpen(false)}>{t("Close")}</Button>
            <Button type="button" onClick={() => { toast.success(t("Note saved")); setOpen(false); }}>
              {t("Save")} <SendHorizontal className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SelectField({
  value,
  onChange,
  options,
  placeholder,
  emptyHint,
}: {
  value: string;
  onChange: (v: string) => void;
  options: IdName[];
  placeholder?: string;
  emptyHint?: string;
}) {
  const t = useT();
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">{emptyHint ?? t("No options yet.")}</p>
        ) : (
          options.map((o) => (
            <SelectItem key={o.id} value={o.id}><span dir="auto">{o.name}</span></SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-[#595959]">{label}</span>
      {children}
    </div>
  );
}

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
