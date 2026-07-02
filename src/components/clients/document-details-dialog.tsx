"use client";

import * as React from "react";

import {
  getDocumentDetails,
  type DocumentDetails,
} from "@/app/(app)/clients/client-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isNoExpiry } from "@/lib/clients";
import { formatDate as fmtDate, formatDateTime as fmtDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const money = (n: number) => `₪${n.toFixed(2)}`;

// payment_method enum → English label (translated via t() below).
const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  credit_card: "Credit card",
  cheque: "Cheque",
  bank_transfer: "Bank transfer",
  direct_debit: "Direct debit",
};

/**
 * View-only "digital receipt" for one accounting document: header (type / number
 * / date), the client, what it bills (plan + period/limits), the financial
 * totals, and a mini payment-history table. Mount it keyed by the document id so
 * it refetches per open. No writes.
 */
export function DocumentDetailsDialog({
  documentId,
  onOpenChange,
}: {
  documentId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [details, setDetails] = React.useState<DocumentDetails | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    getDocumentDetails(documentId).then((res) => {
      if (!active) return;
      if (res.ok) setDetails(res.details);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [documentId]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      {/* Viewport-clamped (vw, not %) so the nowrap payment-history table can
          never push the dialog past a phone screen; tall receipts scroll. */}
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Document details")}</DialogTitle>
          <DialogDescription className="sr-only">{t("Document details")}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : !details ? (
          <Skeleton />
        ) : (
          <Receipt details={details} t={t} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Receipt({
  details,
  t,
}: {
  details: DocumentDetails;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const { item } = details;
  const outstanding = details.balance > 0.005;

  return (
    // min-w-0: as a grid item of DialogContent the receipt must be allowed to
    // shrink below the table's intrinsic width, or it drags the dialog wide.
    <div className="flex min-w-0 flex-col divide-y divide-border rounded-lg ring-1 ring-border">
      {/* Header — type, number, date */}
      <div className="flex items-start justify-between gap-3 bg-muted/40 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{t(details.typeLabel)}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(details.date)}</p>
        </div>
        <span className="shrink-0 rounded-md bg-background px-2 py-1 text-sm font-medium tabular-nums ring-1 ring-border" dir="ltr">
          #{details.docNumber}
        </span>
      </div>

      {/* Client */}
      <Row label={t("Client")}>
        <span dir="auto" className="font-medium">{details.clientName}</span>
      </Row>

      {/* Itemised — what the document is for. Typed line items take priority;
          otherwise fall back to the billed plan, then the document type. With
          3+ items the list scrolls so the receipt's totals stay visible. */}
      <div
        className={cn(
          "flex flex-col divide-y divide-border/60",
          details.lineItems.length >= 3 && "max-h-44 overflow-y-auto"
        )}
      >
        {details.lineItems.length > 0 ? (
          details.lineItems.map((li, i) => (
            <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p dir="auto" className="truncate text-sm font-medium text-foreground">{li.name}</p>
                {li.qty > 1 && (
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground" dir="ltr">
                    {li.qty} × {money(li.unitPrice)}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{money(li.total)}</span>
            </div>
          ))
        ) : (
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p dir="auto" className="truncate text-sm font-medium text-foreground">
                {item ? item.planName : t(details.typeLabel)}
              </p>
              {item && (
                <p className="mt-0.5 text-xs text-muted-foreground">{itemSubtitle(item, t)}</p>
              )}
            </div>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{money(details.total)}</span>
          </div>
        )}
      </div>

      {/* Financials */}
      <div className="flex flex-col gap-1.5 px-4 py-3 text-sm">
        <Line label={t("Subtotal")} value={money(details.subtotal)} muted />
        <Line label={t("VAT")} value={money(details.vat)} muted />
        <Line label={t("Total")} value={money(details.total)} bold />
        <Line
          label={t("Balance")}
          value={money(details.balance)}
          className={cn("pt-1", outstanding ? "text-amber-600" : "text-emerald-600")}
          bold
        />
      </div>

      {/* Payment history */}
      <div className="px-4 py-3">
        <p className="mb-2 text-sm font-semibold">{t("Payment history")}</p>
        {details.payments.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">{t("No payments recorded yet.")}</p>
        ) : (
          <div className="max-w-full overflow-x-auto rounded-md ring-1 ring-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">{t("Date")}</TableHead>
                  <TableHead className="text-xs">{t("Payment method")}</TableHead>
                  <TableHead className="text-xs">{t("Reference")}</TableHead>
                  <TableHead className="text-end text-xs">{t("Amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(p.date)}</TableCell>
                    <TableCell className="text-xs">{t(METHOD_LABELS[p.method] ?? p.method)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground" dir="auto">{p.reference || "—"}</TableCell>
                    <TableCell className="text-end text-xs tabular-nums">{money(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Class-pass: "12 Classes · No Expiration"; otherwise the date range. */
function itemSubtitle(
  item: NonNullable<DocumentDetails["item"]>,
  t: (k: string) => string
): string {
  if (item.isClassPlan) {
    const parts: string[] = [];
    if (item.classesLimit != null) parts.push(`${item.classesLimit} ${t("Classes")}`);
    parts.push(isNoExpiry(item.endDate) ? t("No Expiration") : `${fmtDate(item.startDate)} – ${fmtDate(item.endDate)}`);
    return parts.join(" · ");
  }
  return `${fmtDate(item.startDate)} – ${fmtDate(item.endDate)}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Line({
  label,
  value,
  muted,
  bold,
  className,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className={cn(muted && "text-muted-foreground", bold && "font-semibold")}>{label}</span>
      <span className={cn("tabular-nums", bold && "font-semibold")}>{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 py-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-muted/60" />
      ))}
    </div>
  );
}
