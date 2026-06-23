"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Package, Plus } from "lucide-react";
import { toast } from "sonner";

import { createSubscription } from "@/app/(app)/clients/client-actions";
import { FormDialog } from "@/components/clients/form-dialog";
import { SubscriptionDialog } from "@/components/clients/subscription-dialog";
import { Button } from "@/components/ui/button";
import { INVOICE_TYPES, type SubscriptionPlanOption } from "@/lib/clients";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Profile speed-dial FAB. Expands to "Purchase Package" (a quick single-form
 * subscription) and "Classes Subscription" (the full wizard). Both persist a
 * real subscription (and its accounting document) and refresh the profile.
 */
export function ProfileSpeedDial({
  clientId,
  planOptions,
}: {
  clientId: string;
  planOptions: SubscriptionPlanOption[];
}) {
  const tr = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="fixed end-6 bottom-24 z-40 flex flex-col items-end gap-3">
      {open && (
        <>
          <FormDialog
            title="New Package"
            fields={[
              {
                name: "package",
                label: "Package",
                type: "select",
                required: true,
                defaultValue: planOptions[0]?.id ?? "",
                options: planOptions.map((p) => ({ value: p.id, label: `${p.label} · ₪${p.price}` })),
              },
              { name: "cost", label: "Package Cost", type: "number", defaultValue: String(planOptions[0]?.price ?? 0) },
              { name: "document", label: "Document", type: "select", defaultValue: "receipt_tax_invoice", options: INVOICE_TYPES.map((t) => ({ value: t.value, label: t.label })) },
              { name: "notes", label: "Notes", type: "textarea" },
            ]}
            submitLabel="Purchase"
            onSubmit={(v) => {
              const planId = String(v.package || "");
              const plan = planOptions.find((p) => p.id === planId);
              const start = new Date().toISOString().slice(0, 10);
              void createSubscription(clientId, {
                planId,
                startDate: start,
                endDate: addMonths(start, plan?.periodMonths ?? 1),
                cost: Number(v.cost) || 0,
                notes: String(v.notes || ""),
                documentType: String(v.document || "receipt_tax_invoice"),
                payment: null,
              }).then((res) => {
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success(tr("Package purchased"));
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <SpeedAction label={tr("Purchase Package")} icon={<Package className="size-4" />} />
          </FormDialog>

          <SubscriptionDialog
            mode="new"
            clientId={clientId}
            planOptions={planOptions}
            onSaved={() => {
              setOpen(false);
              router.refresh();
            }}
          >
            <SpeedAction label={tr("Classes Subscription")} icon={<CalendarPlus className="size-4" />} />
          </SubscriptionDialog>
        </>
      )}
      <Button
        size="icon"
        className="size-14 rounded-full shadow-lg"
        aria-label={open ? tr("Close actions") : tr("Open actions")}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className={cn("size-6 transition-transform", open && "rotate-45")} />
      </Button>
    </div>
  );
}

const SpeedAction = React.forwardRef<
  HTMLButtonElement,
  { label: string; icon: React.ReactNode } & React.ComponentProps<"button">
>(function SpeedAction({ label, icon, ...props }, ref) {
  return (
    <button ref={ref} type="button" className="flex items-center gap-2" {...props}>
      <span className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md">
        {label}
      </span>
      <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
        {icon}
      </span>
    </button>
  );
});
