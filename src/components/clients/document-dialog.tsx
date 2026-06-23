"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import { createAccountingDocument } from "@/app/(app)/clients/client-actions";
import { InvoiceItems } from "@/components/clients/invoice-items";
import { PaymentOptions, type PaymentSummary } from "@/components/clients/payment-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { type AccountingDocument, type AccountingInvoiceType } from "@/lib/clients";
import { useT } from "@/lib/i18n/provider";

/**
 * Which document types record a payment (and therefore show Payment Options).
 * Receipts and the combined receipt-tax-invoice take money in; plain
 * invoices/bids/non-formal transactions are documents only.
 */
const HAS_PAYMENTS: Record<AccountingInvoiceType, boolean> = {
  receipt_tax_invoice: true,
  receipt: true,
  informal: true,
  tax_invoice: false,
  refund_invoice: false,
  bid: false,
  non_formal_transaction: false,
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Dynamic "New Document" drawer. Renders the shared invoice fields and, for
 * payment-bearing types, the Payment Options block — matching each type's
 * reference screenshot. Persists via createAccountingDocument; the parent
 * refreshes through `onCreated`.
 */
export function DocumentDialog({
  type,
  label,
  clientId,
  open,
  onOpenChange,
  onCreated,
}: {
  type: AccountingInvoiceType | null;
  label: string;
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (document: AccountingDocument) => void;
}) {
  const tr = useT();
  const [date, setDate] = React.useState(today());
  const totalRef = React.useRef(0);
  const paymentRef = React.useRef<PaymentSummary>({ method: "cash", total: 0 });
  const [pending, startTransition] = React.useTransition();

  // Reset the date each time a new document type is opened.
  React.useEffect(() => {
    if (open) {
      setDate(today());
      totalRef.current = 0;
      paymentRef.current = { method: "cash", total: 0 };
    }
  }, [open]);

  const showPayments = type ? HAS_PAYMENTS[type] : false;

  const create = () => {
    if (!type) return;
    startTransition(async () => {
      const res = await createAccountingDocument(clientId, {
        docType: type,
        issuedOn: date,
        total: totalRef.current,
        payment:
          showPayments && paymentRef.current.total > 0
            ? { method: paymentRef.current.method, amount: paymentRef.current.total, reference: paymentRef.current.reference }
            : null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(tr("Document #{number} created", { number: res.docNumber }));
      onCreated(res.document);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-4xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{tr(label)}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#595959]">
              {tr("Date")} <span className="text-destructive">*</span>
            </span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
          </div>

          {/* Items are common to every document type */}
          <InvoiceItems onTotalChange={(total) => (totalRef.current = total)} />

          {/* Only payment-bearing types show this */}
          {showPayments && (
            <PaymentOptions defaultChequeDate={date} onChange={(p) => (paymentRef.current = p)} />
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#595959]">{tr("Notes")}</span>
            <Textarea placeholder={tr("Notes")} rows={3} />
          </div>
        </div>

        <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onOpenChange(false)}>
            {tr("Cancel")}
          </Button>
          <Button type="button" onClick={create} disabled={pending}>
            {pending ? tr("Adding…") : tr("Add")} <SendHorizontal className="size-4" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
