"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";

import { saveMeasurementType } from "@/app/(app)/settings/measurement-types/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/provider";
import { MEASUREMENT_UNITS, type MeasurementType } from "@/lib/settings/measurement-types";

type FormValues = { name: string; unit: string; notes: string };

function seed(type?: MeasurementType): FormValues {
  return { name: type?.name ?? "", unit: type?.unit || "cm", notes: type?.notes ?? "" };
}

/** Add / Edit Measurement Type drawer. `type` present → edit mode. */
export function MeasurementTypeDialog({
  type,
  onSaved,
  children,
}: {
  type?: MeasurementType;
  onSaved: (type: MeasurementType) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormValues>(seed(type));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setForm(seed(type));
      setError(null);
    }
  }, [open, type]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isEdit = Boolean(type);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError(t("Name is required."));
      return;
    }
    startTransition(async () => {
      const unit = form.unit === "None" ? "" : form.unit;
      const result = await saveMeasurementType({ id: type?.id, name: form.name, unit, notes: form.notes });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved({
        id: result.id,
        name: form.name,
        unit,
        notes: form.notes,
        order: type?.order ?? 0,
        isActive: type?.isActive ?? true,
      });
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Edit Measurement Type") : t("Add Measurement Type")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("Name")}>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("Name")} dir="auto" />
              </Field>
              <Field label={t("Type")}>
                <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" align="start" sideOffset={4}>
                    {MEASUREMENT_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label={t("Notes")}>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("Notes")} rows={3} dir="auto" />
            </Field>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-[#595959]">{label}</span>
      {children}
    </div>
  );
}
