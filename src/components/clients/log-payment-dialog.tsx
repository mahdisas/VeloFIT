"use client";

import * as React from "react";
import { toast } from "sonner";
import { SendHorizontal } from "lucide-react";

import { logPayment } from "@/app/(app)/clients/client-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/provider";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Credit card" },
  { value: "cheque", label: "Cheque" },
  { value: "transfer", label: "Bank transfer" },
] as const;

// Methods that carry an external reference (account no. / transaction id / cheque no.).
const REFERENCE_METHODS = new Set(["card", "transfer", "cheque"]);

/** Local-clock "YYYY-MM-DD" (for the date input's default + max). */
function isoToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Records a Receipt (קבלה) against an existing document — a payments row linked
 * to that document_id, with NO new accounting document. Render it keyed by the
 * document id (mount-per-open) so it seeds from the latest outstanding balance.
 */
export function LogPaymentDialog({
  documentId,
  invoiceNo,
  balance,
  onOpenChange,
  onLogged,
}: {
  documentId: string;
  invoiceNo: string;
  balance: number;
  onOpenChange: (open: boolean) => void;
  onLogged: (amount: number) => void;
}) {
  const t = useT();
  const today = isoToday();
  const [method, setMethod] = React.useState("cash");
  const [amount, setAmount] = React.useState(String(balance));
  const [paidAt, setPaidAt] = React.useState(today);
  const [reference, setReference] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  // Only Bank Transfer / Credit Card / Cheque carry a reference.
  const showReference = REFERENCE_METHODS.has(method);
  const referenceLabel = method === "cheque" ? t("Cheque No.") : t("Account Number / Transaction ID");

  const submit = () => {
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      toast.error(t("Amount must be greater than 0."));
      return;
    }
    startTransition(async () => {
      const res = await logPayment(documentId, { method, amount: amt, paidAt, reference: showReference ? reference : "" });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onLogged(amt);
      toast.success(t("Payment logged"));
      onOpenChange(false);
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Log Payment")}</DialogTitle>
          <DialogDescription>
            {t("Records a receipt against document #{no} — no new invoice is created.", { no: invoiceNo })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field label={t("Payment method")}>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{t(m.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("Amount")}>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>

          <Field label={t("Payment date")}>
            <Input type="date" value={paidAt} max={today} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>

          {showReference && (
            <Field label={referenceLabel}>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} dir="auto" placeholder={t("Optional")} />
            </Field>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Close")}</Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? t("Saving…") : t("Log Payment")} <SendHorizontal className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
