"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";

import { saveGroup } from "@/app/(app)/classes/groups/actions";
import { MultiSelect } from "@/components/classes/multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { type Group, type GroupClassOption } from "@/lib/groups";

type PriceKey = "price1m" | "price2m" | "price3m" | "price4m" | "price6m" | "priceYearly";

const PRICE_FIELDS: { key: PriceKey; label: string }[] = [
  { key: "price1m", label: "Price per month" },
  { key: "price2m", label: "Price two months" },
  { key: "price3m", label: "Price 3 months" },
  { key: "price4m", label: "Price 4 months" },
  { key: "price6m", label: "Price 6 months" },
  { key: "priceYearly", label: "Annual price" },
];

type FormValues = {
  name: string;
  classIds: string[];
  notes: string;
} & Record<PriceKey, string>;

function seed(group?: Group): FormValues {
  return {
    name: group?.name ?? "",
    classIds: group?.classIds ?? [],
    notes: group?.notes ?? "",
    price1m: group?.price1m ? String(group.price1m) : "",
    price2m: group?.price2m ? String(group.price2m) : "",
    price3m: group?.price3m ? String(group.price3m) : "",
    price4m: group?.price4m ? String(group.price4m) : "",
    price6m: group?.price6m ? String(group.price6m) : "",
    priceYearly: group?.priceYearly ? String(group.priceYearly) : "",
  };
}

/** Add / Edit Group drawer. `group` present → edit mode. */
export function GroupDialog({
  group,
  classOptions,
  onSaved,
  children,
}: {
  group?: Group;
  classOptions: GroupClassOption[];
  onSaved: (group: Group) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormValues>(seed(group));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setForm(seed(group));
      setError(null);
    }
  }, [open, group]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isEdit = Boolean(group);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError(t("Name is required."));
      return;
    }
    const num = (v: string) => Number(v) || 0;
    startTransition(async () => {
      const result = await saveGroup({
        id: group?.id,
        name: form.name,
        classIds: form.classIds,
        notes: form.notes,
        price1m: num(form.price1m),
        price2m: num(form.price2m),
        price3m: num(form.price3m),
        price4m: num(form.price4m),
        price6m: num(form.price6m),
        priceYearly: num(form.priceYearly),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved({
        id: result.id,
        name: form.name,
        classIds: form.classIds,
        notes: form.notes,
        price1m: num(form.price1m),
        price2m: num(form.price2m),
        price3m: num(form.price3m),
        price4m: num(form.price4m),
        price6m: num(form.price6m),
        priceYearly: num(form.priceYearly),
        isActive: group?.isActive ?? true,
      });
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Edit group") : t("Add new group")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <Field label={t("Name")}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("Name")} dir="auto" />
            </Field>

            <Field label={t("Classes")}>
              <MultiSelect
                options={classOptions}
                value={form.classIds}
                onChange={(ids) => set("classIds", ids)}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              {PRICE_FIELDS.map((f) => (
                <PriceField
                  key={f.key}
                  label={t(f.label)}
                  value={form[f.key]}
                  onChange={(v) => set(f.key, v)}
                />
              ))}
            </div>

            <Field label={t("Notes")}>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("Write a Note")} rows={3} dir="auto" />
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

/** Outlined input with a notched floating label and a ₪ prefix. */
function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative rounded-md border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
      <label className="absolute -top-2 start-2 bg-background px-1 text-[11px] text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-1 px-2.5 py-2">
        <span className="text-sm text-muted-foreground">₪</span>
        <input
          type="number"
          min={0}
          step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#595959]">{label}</span>
      {children}
    </div>
  );
}
