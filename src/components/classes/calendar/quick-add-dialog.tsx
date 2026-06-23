"use client";

import * as React from "react";
import { toast } from "sonner";
import { SendHorizontal } from "lucide-react";

import { quickAddSession } from "@/app/(app)/classes/calendar/actions";
import { useCalendarSessions } from "@/components/classes/calendar/calendar-sessions-context";
import { Button } from "@/components/ui/button";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { addOneHour, toISO } from "@/lib/calendar";
import { type IdName } from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";

/**
 * Quick-add: drop an existing class onto a specific day. Controlled by the
 * parent (cell "+" / FAB) via `date`; right-side drawer like every other popup.
 */
export function QuickAddDialog({
  open,
  onOpenChange,
  date,
  classOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  classOptions: IdName[];
}) {
  const t = useT();
  const { mergeSessions } = useCalendarSessions();
  const [classId, setClassId] = React.useState("");
  const [day, setDay] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [asSeries, setAsSeries] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setClassId("");
      setDay(date ? toISO(date) : "");
      setFrom("");
      setTo("");
      setAsSeries(false);
      setError(null);
    }
  }, [open, date]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await quickAddSession({ classId, date: day, from, to, asSeries });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      mergeSessions(result.sessions); // show the new session(s) on the grid immediately
      toast.success(asSeries ? t("Class series added to the calendar") : t("Class added to the calendar"));
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t("Add new class")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <Field label={t("Choose class")}>
              <Select value={classId || undefined} onValueChange={setClassId}>
                <SelectTrigger className="w-full"><SelectValue placeholder={t("Choose class")} /></SelectTrigger>
                <SelectContent>
                  {classOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}><span dir="auto">{o.name}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div dir="ltr" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("Date")}>
                <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
              <Field label={t("From Hour")}>
                <TimeField
                  value={from}
                  onChange={(v) => { setFrom(v); if (v) setTo(addOneHour(v)); }}
                />
              </Field>
              <Field label={t("To Hour")}>
                <TimeField value={to} onChange={setTo} />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#595959]">
                {t("Adding the class as a series (for example, adding the hours you chose to all Sundays)?")}
              </span>
              <Switch checked={asSeries} onCheckedChange={setAsSeries} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onOpenChange(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving…") : t("Add")} <SendHorizontal className="size-4" />
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
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
