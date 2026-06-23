"use client";

import * as React from "react";
import { Check, SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  createSubscription,
  updateSubscription,
} from "@/app/(app)/clients/client-actions";
import { InvoiceItems } from "@/components/clients/invoice-items";
import { PaymentOptions, type PaymentSummary } from "@/components/clients/payment-options";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  INVOICE_TYPES,
  type ClientSubscription,
  type SubscriptionPlanOption,
} from "@/lib/clients";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const PERIODS: { value: string; label: string; months: number }[] = [
  { value: "1m", label: "1 Month", months: 1 },
  { value: "3m", label: "3 Months", months: 3 },
  { value: "6m", label: "6 Months", months: 6 },
  { value: "12m", label: "1 Year", months: 12 },
];

const today = () => new Date().toISOString().slice(0, 10);

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Closest preset period for a given month count (for editing existing subs). */
function periodFromMonths(months: number): string {
  return PERIODS.find((p) => p.months === months)?.value ?? "1m";
}

type FormState = {
  planId: string;
  fromDate: string;
  period: string;
  toDate: string;
  cost: string;
  document: string;
  cancellationBalance: string;
  maxPerDay: string;
  maxPerWeek: string;
  maxPerMonth: string;
  maxTotal: string;
  autoEnroll: boolean;
  notes: string;
};

function initialState(
  planOptions: SubscriptionPlanOption[],
  sub?: ClientSubscription
): FormState {
  const firstPlan = planOptions[0];
  return {
    planId: sub?.planId ?? firstPlan?.id ?? "",
    fromDate: sub?.fromDate ?? today(),
    period: "1m",
    toDate: sub?.toDate ?? addMonths(today(), firstPlan?.periodMonths ?? 1),
    cost: sub ? String(sub.cost) : String(firstPlan?.price ?? 0),
    document: "receipt_tax_invoice",
    cancellationBalance: sub ? String(sub.limits.cancellationBalance) : "0",
    maxPerDay: sub ? String(sub.limits.maxPerDay) : "0",
    maxPerWeek: sub ? String(sub.limits.maxPerWeek) : "0",
    maxPerMonth: sub ? String(sub.limits.maxPerMonth) : "0",
    maxTotal: sub ? String(sub.limits.maxTotal) : "0",
    autoEnroll: sub ? sub.limits.autoEnroll : false,
    notes: sub?.notes ?? "",
  };
}

/**
 * New (2-step wizard) / Edit (single form) subscription dialog. A subscription
 * references a real package (subscription_plans); the "Group" picker lists the
 * gym's packages. Saving persists via the server actions, and the parent
 * refreshes through `onSaved`.
 */
export function SubscriptionDialog({
  mode,
  clientId,
  subscription,
  planOptions,
  onSaved,
  children,
}: {
  mode: "new" | "edit";
  clientId: string;
  subscription?: ClientSubscription;
  planOptions: SubscriptionPlanOption[];
  onSaved: () => void;
  children: React.ReactNode;
}) {
  const tr = useT();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState<FormState>(initialState(planOptions, subscription));
  const [payment, setPayment] = React.useState<PaymentSummary>({ method: "cash", total: 0 });
  const [pending, startTransition] = React.useTransition();

  const reset = () => {
    setForm(initialState(planOptions, subscription));
    setPayment({ method: "cash", total: 0 });
    setStep(1);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Picking a package prefills cost + end date from the plan's price/length.
  const setPlan = (planId: string) => {
    const plan = planOptions.find((p) => p.id === planId);
    setForm((prev) => ({
      ...prev,
      planId,
      cost: plan ? String(plan.price) : prev.cost,
      period: plan ? periodFromMonths(plan.periodMonths) : prev.period,
      toDate: plan ? addMonths(prev.fromDate, plan.periodMonths) : prev.toDate,
    }));
  };

  // Auto-compute the end date from start date + period.
  const setFrom = (fromDate: string) => {
    const months = PERIODS.find((p) => p.value === form.period)?.months ?? 1;
    setForm((prev) => ({ ...prev, fromDate, toDate: addMonths(fromDate, months) }));
  };
  const setPeriod = (period: string) => {
    const months = PERIODS.find((p) => p.value === period)?.months ?? 1;
    setForm((prev) => ({ ...prev, period, toDate: addMonths(prev.fromDate, months) }));
  };

  const isEdit = mode === "edit";

  // Enrollment caps + cancellation balance + auto-enroll, persisted per subscription.
  const formLimits = () => ({
    maxPerDay: Number(form.maxPerDay) || 0,
    maxPerWeek: Number(form.maxPerWeek) || 0,
    maxPerMonth: Number(form.maxPerMonth) || 0,
    maxTotal: Number(form.maxTotal) || 0,
    cancellationBalance: Number(form.cancellationBalance) || 0,
    autoEnroll: form.autoEnroll,
  });

  const submit = () =>
    startTransition(async () => {
      if (isEdit && subscription) {
        const res = await updateSubscription(subscription.id, clientId, {
          startDate: form.fromDate,
          endDate: form.toDate,
          cost: Number(form.cost) || 0,
          notes: form.notes,
          limits: formLimits(),
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(tr("Subscription updated"));
      } else {
        if (!form.planId) {
          toast.error(tr("Pick a subscription package first."));
          return;
        }
        const res = await createSubscription(clientId, {
          planId: form.planId,
          startDate: form.fromDate,
          endDate: form.toDate,
          cost: Number(form.cost) || 0,
          notes: form.notes,
          documentType: form.document,
          payment: payment.total > 0 ? { method: payment.method, amount: payment.total, reference: payment.reference } : null,
          limits: formLimits(),
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(tr("Subscription created"));
      }
      setOpen(false);
      reset();
      onSaved();
    });

  const noPlans = planOptions.length === 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Re-sync the form from the latest subscription data on every open (and
        // reset on close), so a reopen always reflects the persisted caps.
        reset();
      }}
    >
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:md:max-w-3xl data-[side=right]:lg:max-w-5xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? tr("Edit subscription") : tr("New subscription")}</SheetTitle>
        </SheetHeader>

        {/* Stepper (new only) */}
        {!isEdit && (
          <div className="flex items-center gap-3 px-6 pt-5 text-sm">
            <Step n={1} active={step === 1} label={tr("Subscription details")} />
            <div className="h-px flex-1 bg-border" />
            <Step n={2} active={step === 2} label={tr("Payments")} />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {step === 1 || isEdit ? (
            <>
              {noPlans && !isEdit && (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {tr("No subscription packages yet. Create one in")}{" "}
                  <span className="font-medium text-foreground">{tr("Finance · Subscription Packages")}</span> {tr("first.")}
                </p>
              )}
              <Field label={tr("Group")}>
                <Select value={form.planId} onValueChange={setPlan} disabled={isEdit || noPlans}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={tr("Select a package")} /></SelectTrigger>
                  <SelectContent>
                    {planOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span dir="auto">{p.label}</span>
                        <span className="text-muted-foreground"> · ₪{p.price}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label={tr("From date")}>
                  <Input type="date" value={form.fromDate} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label={tr("Period")}>
                  <Select value={form.period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERIODS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{tr(p.label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={tr("To date")}>
                  <Input type="date" value={form.toDate} onChange={(e) => set("toDate", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {!isEdit && (
                  <Field label={tr("Subscription cost")}>
                    <Input type="number" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
                  </Field>
                )}
                {!isEdit && (
                  <Field label={tr("Document")}>
                    <Select value={form.document} onValueChange={(v) => set("document", v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INVOICE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{tr(t.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {isEdit && (
                  <Field label={tr("Subscription cost")}>
                    <Input type="number" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
                  </Field>
                )}
                <Field label={tr("Cancellation balance")}>
                  <Input type="number" value={form.cancellationBalance} onChange={(e) => set("cancellationBalance", e.target.value)} />
                </Field>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">{tr("Max enrollments (0 means no limits)")}</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label={tr("Maximum classes per day")}>
                    <Input type="number" value={form.maxPerDay} onChange={(e) => set("maxPerDay", e.target.value)} />
                  </Field>
                  <Field label={tr("Maximum enrollments per week")}>
                    <Input type="number" value={form.maxPerWeek} onChange={(e) => set("maxPerWeek", e.target.value)} />
                  </Field>
                  <Field label={tr("Maximum classes per month")}>
                    <Input type="number" value={form.maxPerMonth} onChange={(e) => set("maxPerMonth", e.target.value)} />
                  </Field>
                  <Field label={tr("Maximum classes in the entire period")}>
                    <Input type="number" value={form.maxTotal} onChange={(e) => set("maxTotal", e.target.value)} />
                  </Field>
                </div>
              </div>

              {!isEdit && (
                <label className="flex items-center gap-2.5">
                  <Checkbox checked={form.autoEnroll} onCheckedChange={(c) => set("autoEnroll", c === true)} />
                  <span className="text-sm text-[#595959]">{tr("Enroll for all classes automatically?")}</span>
                </label>
              )}

              <Field label={tr("Notes")}>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={tr("Notes")} rows={3} />
              </Field>
            </>
          ) : (
            <PaymentsStep
              documentLabel={tr(INVOICE_TYPES.find((t) => t.value === form.document)?.label ?? "Document")}
              fromDate={form.fromDate}
              toDate={form.toDate}
              cost={Number(form.cost) || 0}
              onPaymentChange={setPayment}
            />
          )}
        </div>

        <SheetFooter className="flex-row items-center gap-2 border-t px-6 py-4">
          {!isEdit && step === 2 && (
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>{tr("Back")}</Button>
          )}
          <Button type="button" variant="ghost" className="ms-auto text-destructive hover:text-destructive" onClick={() => setOpen(false)}>
            {tr("Cancel")}
          </Button>
          {isEdit ? (
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? tr("Updating…") : tr("Update")} <SendHorizontal className="size-4" />
            </Button>
          ) : step === 1 ? (
            <Button type="button" onClick={() => setStep(2)} disabled={noPlans || !form.planId}>{tr("Next")}</Button>
          ) : (
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? tr("Saving…") : tr("Save")} <Check className="size-4" />
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Step({ n, active, label }: { n: number; active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-medium", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {n}
      </span>
      <span className={cn(active ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
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

/** Step 2 of the new-subscription wizard: invoice items + payment options. */
function PaymentsStep({
  documentLabel,
  fromDate,
  toDate,
  cost,
  onPaymentChange,
}: {
  documentLabel: string;
  fromDate: string;
  toDate: string;
  cost: number;
  onPaymentChange: (p: PaymentSummary) => void;
}) {
  const tr = useT();
  const [date, setDate] = React.useState(fromDate);
  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-base font-semibold">{documentLabel}</h3>

      <Field label={tr("Date")}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
      </Field>

      <InvoiceItems
        defaultLabel={tr("For a new subscription from date {from} to date {to}", { from: fromDate, to: toDate })}
        defaultUnitPrice={cost}
      />

      <PaymentOptions defaultChequeDate={fromDate} onChange={onPaymentChange} />

      <Field label={tr("Notes")}>
        <Textarea placeholder={tr("Notes")} rows={3} />
      </Field>
    </div>
  );
}
