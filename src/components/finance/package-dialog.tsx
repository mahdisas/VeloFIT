"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";

import { savePackage } from "@/app/(app)/finance/subscription-packages/actions";
import { ColorPicker } from "@/components/classes/color-picker";
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
import { type IdName } from "@/lib/classes";
import { type SubscriptionPackage } from "@/lib/finance/packages";
import { useT } from "@/lib/i18n/provider";

type FormValues = {
  name: string;
  isTrialLesson: boolean;
  price: string;
  maxPurchases: string;
  periodMonths: string;
  color: string;
  maximumPayments: string;
  showInApp: boolean;
  description: string;
  groupId: string;
};

function seed(pkg?: SubscriptionPackage): FormValues {
  return {
    name: pkg?.name ?? "",
    isTrialLesson: pkg?.isTrialLesson ?? false,
    price: pkg ? String(pkg.price) : "",
    maxPurchases: pkg ? String(pkg.maxPurchases) : "",
    periodMonths: pkg ? String(pkg.periodMonths) : "",
    color: pkg?.color ?? "#ec1c79",
    maximumPayments: pkg ? String(pkg.maximumPayments) : "1",
    showInApp: pkg?.showInApp ?? true,
    description: pkg?.description ?? "",
    groupId: pkg?.groupId ?? "",
  };
}

const PAYMENT_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));

/** Add / Edit Subscription Package drawer. `pkg` present → edit mode. */
export function PackageDialog({
  pkg,
  groupOptions,
  onSaved,
  children,
}: {
  pkg?: SubscriptionPackage;
  groupOptions: IdName[];
  onSaved: (pkg: SubscriptionPackage) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormValues>(seed(pkg));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setForm(seed(pkg));
      setError(null);
    }
  }, [open, pkg]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isEdit = Boolean(pkg);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError(t("Name is required."));
      return;
    }
    startTransition(async () => {
      const result = await savePackage({
        id: pkg?.id,
        name: form.name,
        color: form.color,
        groupId: form.groupId || null,
        price: Number(form.price) || 0,
        maxPurchases: Number(form.maxPurchases) || 0,
        periodMonths: Number(form.periodMonths) || 1,
        maximumPayments: Number(form.maximumPayments) || 1,
        isTrialLesson: form.isTrialLesson,
        showInApp: form.showInApp,
        description: form.description,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved({
        id: result.id,
        name: form.name,
        color: form.color,
        groupId: form.groupId || null,
        groupName: groupOptions.find((g) => g.id === form.groupId)?.name ?? "",
        price: Number(form.price) || 0,
        maxPurchases: Number(form.maxPurchases) || 0,
        periodMonths: Number(form.periodMonths) || 1,
        maximumPayments: Number(form.maximumPayments) || 1,
        isTrialLesson: form.isTrialLesson,
        showInApp: form.showInApp,
        description: form.description,
        isActive: pkg?.isActive ?? true,
      });
      setOpen(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Edit Package") : t("New Package")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <div className="flex items-end gap-4">
              <Field label={t("Name")} className="flex-1">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("Enter name")} dir="auto" />
              </Field>
              <div className="flex items-center gap-2.5 pb-2">
                <span className="text-sm text-[#595959]">{t("Is trial lesson")}</span>
                <Switch checked={form.isTrialLesson} onCheckedChange={(v) => set("isTrialLesson", v)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("Price")}>
                <Input type="number" min={0} step="1" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder={t("Enter price")} />
              </Field>
              <Field label={t("Max purchases")}>
                <Input type="number" min={0} value={form.maxPurchases} onChange={(e) => set("maxPurchases", e.target.value)} placeholder={t("Enter max purchases")} />
                <span className="text-xs text-muted-foreground">{t("0 = Unlimited")}</span>
              </Field>
              <Field label={t("Months")}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#595959]">{t("Every")}</span>
                  <Input type="number" min={1} value={form.periodMonths} onChange={(e) => set("periodMonths", e.target.value)} placeholder={t("Months")} />
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("Color")}>
                <ColorPicker value={form.color} onChange={(c) => set("color", c)} />
              </Field>
              <Field label={t("Maximum payments")}>
                <Select value={form.maximumPayments} onValueChange={(v) => set("maximumPayments", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" align="start" sideOffset={4}>
                    {PAYMENT_OPTIONS.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-[#595959]">{t("Show in app")}</span>
              <Switch checked={form.showInApp} onCheckedChange={(v) => set("showInApp", v)} />
            </div>

            <Field label={t("Description")}>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("Enter description")} rows={3} dir="auto" />
            </Field>

            <Field label={t("Choose group")}>
              <Select value={form.groupId || undefined} onValueChange={(v) => set("groupId", v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder={t("Choose group")} /></SelectTrigger>
                <SelectContent position="popper" align="start" sideOffset={4}>
                  {groupOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}><span dir="auto">{o.name}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-sm text-[#595959]">{label}</span>
      {children}
    </div>
  );
}
