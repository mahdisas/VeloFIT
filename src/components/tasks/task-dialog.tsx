"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";

import { saveTask } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/provider";
import { TASK_STATUSES, type TaskRow, type TaskStatus } from "@/lib/tasks";

type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  addReminder: boolean;
  reminderDate: string;
  blockingEntry: boolean;
};

function seed(task?: TaskRow): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "new",
    addReminder: task ? task.reminderDate != null : false,
    reminderDate: task?.reminderDate ?? "",
    blockingEntry: task?.blockingEntry ?? false,
  };
}

/**
 * Add / Edit Task drawer. `task` present → edit mode. `onSaved` receives the
 * resulting row so the table can update in place.
 */
export function TaskDialog({
  task,
  onSaved,
  children,
}: {
  task?: TaskRow;
  onSaved: (task: TaskRow) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<TaskFormValues>(seed(task));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setForm(seed(task));
      setError(null);
    }
  }, [open, task]);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isEdit = Boolean(task);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError(t("Title is required."));
      return;
    }
    if (form.addReminder && !form.reminderDate) {
      setError(t("Reminder date is required."));
      return;
    }
    startTransition(async () => {
      const reminderDate = form.addReminder ? form.reminderDate : null;
      const result = await saveTask({
        id: task?.id,
        clientId: task?.clientId,
        title: form.title,
        description: form.description,
        status: form.status,
        reminderDate,
        blockingEntry: form.blockingEntry,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved({
        id: result.id,
        clientId: task?.clientId ?? "",
        clientName: task?.clientName ?? "—",
        date: task?.date ?? new Date().toISOString().slice(0, 10),
        title: form.title,
        description: form.description,
        status: form.status,
        reminderDate,
        blockingEntry: form.blockingEntry,
      });
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Edit Task") : t("New Task")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <Field label={t("Title")} required>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} dir="auto" />
            </Field>

            <Field label={t("Description")}>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} dir="auto" />
            </Field>

            <Field label={t("Status")}>
              <Select value={form.status} onValueChange={(v) => set("status", v as TaskStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{t(s.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <label className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#595959]">{t("Add a reminder?")}</span>
              <Switch checked={form.addReminder} onCheckedChange={(v) => set("addReminder", v)} />
            </label>

            <div className="flex flex-wrap items-end gap-8">
              {form.addReminder && (
                <Field label={t("Reminder date")} required>
                  <Input type="date" value={form.reminderDate} onChange={(e) => set("reminderDate", e.target.value)} className="w-48" />
                </Field>
              )}
              <label className="flex items-center gap-3 pb-2">
                <span className="text-sm font-medium text-[#595959]">{t("Blocking entry")}</span>
                <Switch checked={form.blockingEntry} onCheckedChange={(v) => set("blockingEntry", v)} />
              </label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {isEdit ? t("Update") : t("Add")} <SendHorizontal className="size-4" />
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#595959]">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </div>
  );
}
