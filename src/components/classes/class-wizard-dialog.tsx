"use client";

import * as React from "react";
import { Check, Plus, SendHorizontal, Trash2 } from "lucide-react";

import { createClass, updateClass } from "@/app/(app)/classes/class-actions";
import { ClassHoursEditor } from "@/components/classes/class-hours-editor";
import { ColorPicker } from "@/components/classes/color-picker";
import { MultiSelect } from "@/components/classes/multi-select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type ClassItem,
  type Equipment,
  type IdName,
  type WeeklyHours,
} from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const STEPS = ["Class Details", "Class Settings", "Class Hours"];

const emptyWeek = (): WeeklyHours => [[], [], [], [], [], [], []];

type FormState = Omit<ClassItem, "id" | "isActive">;

function seed(cls: ClassItem | undefined, defaults: Partial<FormState>): FormState {
  return {
    name: cls?.name ?? "",
    groupIds: cls?.groupIds ?? [],
    description: cls?.description ?? "",
    isFree: cls?.isFree ?? false,
    notifyTrainer: cls?.notifyTrainer ?? false,
    trainerId: cls?.trainerId ?? defaults.trainerId ?? null,
    hourlyRate: cls?.hourlyRate ?? 0,
    classKindId: cls?.classKindId ?? defaults.classKindId ?? null,
    location: cls?.location ?? defaults.location ?? null,
    color: cls?.color ?? "#ec1c79",
    enrollBeforeHours: cls?.enrollBeforeHours ?? 0,
    closeRegistrationHours: cls?.closeRegistrationHours ?? 0,
    cancelBeforeHours: cls?.cancelBeforeHours ?? null,
    allowLateCancellation: cls?.allowLateCancellation ?? false,
    waitingListByDefault: cls?.waitingListByDefault ?? false,
    showEnrollList: cls?.showEnrollList ?? false,
    showMaxParticipants: cls?.showMaxParticipants ?? true,
    allowWaitingList: cls?.allowWaitingList ?? false,
    equipments: cls?.equipments ?? [],
    startDate: cls?.startDate ?? null,
    expireDate: cls?.expireDate ?? null,
    minParticipants: cls?.minParticipants ?? 0,
    maxParticipants: cls?.maxParticipants ?? 8,
    cancelIfBelowMin: cls?.cancelIfBelowMin ?? false,
    weeklyHours: cls?.weeklyHours ?? emptyWeek(),
  };
}

export function ClassWizardDialog({
  classItem,
  trainers,
  classKinds,
  locations,
  groups,
  onSaved,
  children,
}: {
  classItem?: ClassItem;
  trainers: IdName[];
  classKinds: IdName[];
  locations: IdName[];
  groups: IdName[];
  onSaved: (cls: ClassItem) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const isEdit = Boolean(classItem);
  // Trainer + location are optional (nullable FKs) → let staff pick consciously.
  // Class kind is required, so pre-select the first available one.
  const defaults: Partial<FormState> = {
    trainerId: null,
    classKindId: classKinds[0]?.id ?? null,
    location: null,
  };

  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<FormState>(seed(classItem, defaults));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setForm(seed(classItem, defaults));
      setStep(0);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classItem]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const next = () => {
    if (step === 0 && !form.name.trim()) {
      setError(t("Name is required."));
      return;
    }
    setError(null);
    setStep((s) => Math.min(2, s + 1));
  };

  const save = () =>
    startTransition(async () => {
      const result =
        isEdit && classItem ? await updateClass(classItem.id, form) : await createClass(form);
      if (!result.ok) {
        setError(result.error);
        setStep(0);
        return;
      }
      onSaved({ id: result.id, isActive: classItem?.isActive ?? true, ...form });
      setOpen(false);
    });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-3xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Edit Class Data") : t("Add New Class")}</SheetTitle>
        </SheetHeader>

        <div className="border-b px-6 py-4">
          <Stepper step={step} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <StepDetails form={form} set={set} trainers={trainers} classKinds={classKinds} locations={locations} groups={groups} />
          )}
          {step === 1 && <StepSettings form={form} set={set} />}
          {step === 2 && (
            <ClassHoursEditor value={form.weeklyHours} onChange={(w) => set("weeklyHours", w)} />
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4">
          {step > 0 ? (
            <Button type="button" variant="ghost" className="text-primary hover:text-primary" onClick={() => setStep((s) => s - 1)}>
              {t("Back")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            {step < 2 ? (
              <Button type="button" onClick={next}>{t("Next")}</Button>
            ) : (
              <Button type="button" onClick={save} disabled={pending}>
                {pending ? t("Saving…") : isEdit ? t("Update") : t("Add")} <SendHorizontal className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stepper({ step }: { step: number }) {
  const t = useT();
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-content-center rounded-full text-xs font-medium",
                  done || active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("text-sm whitespace-nowrap", done || active ? "font-medium text-foreground" : "text-muted-foreground")}>
                {t(label)}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="mx-3 h-px flex-1 bg-border" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Step 1 ──────────────────────────────────────────────────────────────── */

function StepDetails({
  form,
  set,
  trainers,
  classKinds,
  locations,
  groups,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  trainers: IdName[];
  classKinds: IdName[];
  locations: IdName[];
  groups: IdName[];
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>{t("Class Details")}</SectionTitle>

      <Field label={t("Name")}>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("Enter name")} dir="auto" />
      </Field>

      <Field label={t("Groups")}>
        <MultiSelect options={groups} value={form.groupIds} onChange={(ids) => set("groupIds", ids)} />
      </Field>

      <Field label={t("Description")}>
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("Enter description")} rows={3} dir="auto" />
      </Field>

      <label className="flex cursor-pointer items-center gap-2">
        <Switch checked={form.isFree} onCheckedChange={(v) => set("isFree", v)} />
        <span className="text-sm text-[#595959]">{t("Is this a free class?")}</span>
        <span className="grid size-4 place-content-center rounded-full border border-primary text-[10px] leading-none text-primary" title={t("Free classes don't require payment to enroll")}>?</span>
      </label>

      <label className="flex cursor-pointer items-center gap-2.5">
        <Switch checked={form.notifyTrainer} onCheckedChange={(v) => set("notifyTrainer", v)} />
        <span className="text-sm text-[#595959]">{t("Send Notifications to trainer in enrollment or cancellation")}</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("Trainer")}>
          <RelationSelect
            value={form.trainerId}
            onChange={(v) => set("trainerId", v)}
            options={trainers}
            placeholder={t("Select trainer")}
            emptyHint={t("No trainers yet — add one in Settings · Users.")}
            optional
          />
        </Field>
        <Field label={t("Hourly rate")}>
          <Input type="number" min={0} value={form.hourlyRate} onChange={(e) => set("hourlyRate", Number(e.target.value) || 0)} />
        </Field>
        <Field label={t("Class Kind")}>
          <RelationSelect
            value={form.classKindId}
            onChange={(v) => set("classKindId", v)}
            options={classKinds}
            placeholder={t("Select class kind")}
            emptyHint={t("No class kinds yet — create one in Classes · Kinds.")}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Location")}>
          <RelationSelect
            value={form.location}
            onChange={(v) => set("location", v)}
            options={locations}
            placeholder={t("Select location")}
            emptyHint={t("No locations yet — add one in Settings · Locations.")}
            optional
          />
        </Field>
        <Field label={t("Color")}>
          <ColorPicker value={form.color} onChange={(c) => set("color", c)} />
        </Field>
      </div>
    </div>
  );
}

/* ── Step 2 ──────────────────────────────────────────────────────────────── */

function StepSettings({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const t = useT();
  const addEquipment = () =>
    set("equipments", [...form.equipments, { id: `eq-${Date.now()}`, name: "", quantity: 1 }]);
  const updateEquipment = (id: string, patch: Partial<Equipment>) =>
    set("equipments", form.equipments.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeEquipment = (id: string) =>
    set("equipments", form.equipments.filter((e) => e.id !== id));

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>{t("Class Settings")}</SectionTitle>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("Allow enroll before(hours)")}>
          <Input type="number" min={0} value={form.enrollBeforeHours} onChange={(e) => set("enrollBeforeHours", Number(e.target.value) || 0)} />
        </Field>
        <Field label={t("Close registration before(hours)")}>
          <Input type="number" min={0} value={form.closeRegistrationHours} onChange={(e) => set("closeRegistrationHours", Number(e.target.value) || 0)} />
        </Field>
        <Field label={t("Allow enrollment cancellation before(hours)")}>
          <Input
            type="number"
            min={0}
            value={form.cancelBeforeHours ?? ""}
            placeholder={t("Enter hour number")}
            onChange={(e) => set("cancelBeforeHours", e.target.value === "" ? null : Number(e.target.value) || 0)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleRow label={t("Allow late cancellation")} checked={form.allowLateCancellation} onChange={(v) => set("allowLateCancellation", v)} />
        <ToggleRow label={t("Allow enroll to waiting list by default")} checked={form.waitingListByDefault} onChange={(v) => set("waitingListByDefault", v)} />
        <ToggleRow label={t("Show enroll list")} checked={form.showEnrollList} onChange={(v) => set("showEnrollList", v)} />
        <ToggleRow label={t("Show max participants")} checked={form.showMaxParticipants} onChange={(v) => set("showMaxParticipants", v)} />
      </div>

      <ToggleRow label={t("Allow enroll to waiting list")} checked={form.allowWaitingList} onChange={(v) => set("allowWaitingList", v)} className="sm:w-1/2" />

      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-semibold">{t("Class equipments")}</span>
          <button type="button" onClick={addEquipment} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <Plus className="size-4" /> {t("Add Equipments")}
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {form.equipments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("No equipment added.")}</p>
          ) : (
            form.equipments.map((eq) => (
              <div key={eq.id} className="flex items-end gap-3">
                <Input className="flex-1" placeholder={t("Equipment name")} value={eq.name} onChange={(e) => updateEquipment(eq.id, { name: e.target.value })} dir="auto" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("QTY")}</span>
                  <Input type="number" min={1} className="w-20" value={eq.quantity} onChange={(e) => updateEquipment(eq.id, { quantity: Number(e.target.value) || 1 })} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label={t("Remove equipment")} onClick={() => removeEquipment(eq.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Start date")}>
          <DateField value={form.startDate ?? ""} onChange={(v) => set("startDate", v || null)} />
        </Field>
        <Field label={t("Expire date")}>
          <DateField value={form.expireDate ?? ""} onChange={(v) => set("expireDate", v || null)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Min Participants")}>
          <Input type="number" min={0} value={form.minParticipants} onChange={(e) => set("minParticipants", Number(e.target.value) || 0)} />
        </Field>
        <Field label={t("Max Participants")}>
          <Input type="number" min={0} value={form.maxParticipants} onChange={(e) => set("maxParticipants", Number(e.target.value) || 0)} />
        </Field>
      </div>

      <ToggleRow label={t("Cancel the class if there is no minimum participants")} checked={form.cancelIfBelowMin} onChange={(v) => set("cancelIfBelowMin", v)} className="sm:w-2/3" />
    </div>
  );
}

/* ── shared bits ─────────────────────────────────────────────────────────── */

const NONE_VALUE = "__none__";

/**
 * Relation picker for the wizard's FK selects. Degrades gracefully when the gym
 * has no rows yet (shows `emptyHint` instead of an empty menu). `optional` adds
 * a "None" entry and lets the value be cleared to null (for nullable FKs).
 */
function RelationSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyHint,
  optional,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  options: IdName[];
  placeholder: string;
  emptyHint: string;
  optional?: boolean;
}) {
  const t = useT();
  return (
    <Select
      value={value ?? (optional ? NONE_VALUE : undefined)}
      onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
    >
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {optional && (
          <SelectItem value={NONE_VALUE}>
            <span className="text-muted-foreground">{t("None")}</span>
          </SelectItem>
        )}
        {options.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">{emptyHint}</p>
        ) : (
          options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              <span dir="auto">{o.name}</span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    // Switch sits right next to its label (not pushed to the far edge).
    <label className={cn("flex cursor-pointer items-center gap-2.5", className)}>
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-sm text-[#595959]">{label}</span>
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold">{children}</h3>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-[#595959]">{label}</span>
      {children}
    </div>
  );
}
