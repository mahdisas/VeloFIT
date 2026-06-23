"use client";

import * as React from "react";
import {
  ArrowLeftRight,
  CreditCard,
  Plus,
  ReceiptText,
  Trash2,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type PaymentMethod = "cash" | "card" | "cheque" | "transfer";

/** What the parent forms read back: the method, total collected, and a reference
 *  (card confirmation / approval code, or transfer account number). */
export type PaymentSummary = { method: PaymentMethod; total: number; reference?: string };

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: typeof Wallet }[] = [
  { key: "cash", label: "Cash", icon: Wallet },
  { key: "card", label: "Credit Card", icon: CreditCard },
  { key: "cheque", label: "Cheques", icon: ReceiptText },
  { key: "transfer", label: "Bank Transfer", icon: ArrowLeftRight },
];

const BANKS = [
  "Bank Hapoalim",
  "Bank Leumi",
  "Israel Discount Bank",
  "Mizrahi Tefahot",
  "First International Bank",
];

type Cheque = {
  id: string;
  date: string;
  accountNo: string;
  branch: string;
  chequeNo: string;
  bank: string;
  amount: string;
};

/** ₪-prefixed number input used by the amount fields. */
function MoneyInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-sm text-muted-foreground">
        ₪
      </span>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("ps-7", className)}
      />
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

/**
 * "Payment Options": selectable method tabs (Cash / Credit Card / Cheques /
 * Bank Transfer) that each render their own fields below. Shows each method's
 * live allocated amount and the summed "Total paid". Shared by the subscription
 * wizard and the accounting document forms.
 */
export function PaymentOptions({
  defaultChequeDate,
  onChange,
}: {
  defaultChequeDate?: string;
  onChange?: (summary: PaymentSummary) => void;
}) {
  const t = useT();
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [cash, setCash] = React.useState("0");
  const [card, setCard] = React.useState({
    amount: "0",
    payments: "1",
    dealCleared: false,
    confirmation: "",
  });
  const [transfer, setTransfer] = React.useState({ amount: "0", accountNo: "" });
  const [cheques, setCheques] = React.useState<Cheque[]>([]);

  const methodAmount = (key: PaymentMethod): number => {
    switch (key) {
      case "cash":
        return Number(cash) || 0;
      case "card":
        return Number(card.amount) || 0;
      case "transfer":
        return Number(transfer.amount) || 0;
      case "cheque":
        return cheques.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    }
  };
  const totalPaid = PAYMENT_METHODS.reduce((s, m) => s + methodAmount(m.key), 0);

  // The reference that should be persisted with the payment: the card
  // confirmation/approval code, or the transfer account number.
  const reference =
    method === "card" ? card.confirmation.trim() : method === "transfer" ? transfer.accountNo.trim() : "";

  // Report the selected method + total collected + reference up to the parent.
  React.useEffect(() => {
    onChange?.({ method, total: totalPaid, reference: reference || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, totalPaid, reference]);

  const addCheque = () =>
    setCheques((prev) => [
      ...prev,
      { id: `chq-${Date.now()}`, date: defaultChequeDate ?? "", accountNo: "", branch: "", chequeNo: "", bank: "", amount: "0" },
    ]);
  const updateCheque = (id: string, patch: Partial<Cheque>) =>
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCheque = (id: string) => setCheques((prev) => prev.filter((c) => c.id !== id));

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{t("Payment Options")}</h4>
        <Field label={t("Total paid:")}>
          <Input value={totalPaid.toFixed(0)} readOnly className="w-40 bg-muted/50" />
        </Field>
      </div>

      {/* Selectable method tabs — each shows its live allocated amount */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border sm:grid-cols-2 lg:grid-cols-4">
        {PAYMENT_METHODS.map(({ key, label, icon: Icon }) => {
          const active = method === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMethod(key)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2 border-t-2 bg-card px-3 py-3 text-left transition-colors",
                active ? "border-primary" : "border-transparent hover:bg-muted/40"
              )}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className={cn("flex-1 text-start text-sm", active ? "font-medium text-primary" : "text-[#595959]")}>
                {t(label)}
              </span>
              <span className={cn("text-sm font-medium", active ? "text-primary" : "text-foreground")}>
                {methodAmount(key)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Method-specific fields */}
      <div className="pt-2">
        {method === "cash" && (
          <Field label={t("Cash amount")}>
            <MoneyInput value={cash} onChange={setCash} />
          </Field>
        )}

        {method === "card" && (
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 md:grid-cols-3 md:items-end">
              <Field label={t("Credit amount")}>
                <Input
                  type="number"
                  min={0}
                  value={card.amount}
                  onChange={(e) => setCard((p) => ({ ...p, amount: e.target.value }))}
                />
              </Field>
              <Field label={t("Number Of Payments")}>
                <Select value={card.payments} onValueChange={(v) => setCard((p) => ({ ...p, payments: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button type="button" disabled={methodAmount("card") <= 0} onClick={() => setCard((p) => ({ ...p, dealCleared: true }))}>
                {t("Pay Now")}
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <label className="flex items-center gap-3 pb-2">
                <span className="text-sm text-[#595959]">{t("The deal was cleared")}</span>
                <Switch checked={card.dealCleared} onCheckedChange={(c) => setCard((p) => ({ ...p, dealCleared: c }))} />
              </label>
              {card.dealCleared && (
                <Field label={t("Confirmation Number")}>
                  <Input
                    value={card.confirmation}
                    onChange={(e) => setCard((p) => ({ ...p, confirmation: e.target.value }))}
                    className="w-56"
                  />
                </Field>
              )}
            </div>
          </div>
        )}

        {method === "cheque" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <Button type="button" variant="ghost" className="text-primary" onClick={addCheque}>
                <Plus className="size-4" /> {t("Add Cheque")}
              </Button>
            </div>
            {cheques.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("No cheques added yet.")}</p>
            ) : (
              cheques.map((c, i) => (
                <div key={c.id} className="flex flex-col gap-3 rounded-lg p-4 ring-1 ring-foreground/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t("Cheque {n}", { n: i + 1 })}</span>
                    <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" aria-label={t("Remove cheque")} onClick={() => removeCheque(c.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <Field label={t("Date")}>
                      <Input type="date" value={c.date} onChange={(e) => updateCheque(c.id, { date: e.target.value })} />
                    </Field>
                    <Field label={t("Account No")}>
                      <Input value={c.accountNo} onChange={(e) => updateCheque(c.id, { accountNo: e.target.value })} />
                    </Field>
                    <Field label={t("Branch")}>
                      <Input value={c.branch} onChange={(e) => updateCheque(c.id, { branch: e.target.value })} />
                    </Field>
                    <Field label={t("Cheque No.")}>
                      <Input value={c.chequeNo} onChange={(e) => updateCheque(c.id, { chequeNo: e.target.value })} />
                    </Field>
                    <Field label={t("Bank")}>
                      <Select value={c.bank} onValueChange={(v) => updateCheque(c.id, { bank: v })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder={t("Select a bank")} /></SelectTrigger>
                        <SelectContent>
                          {BANKS.map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t("Amount")}>
                      <MoneyInput value={c.amount} onChange={(v) => updateCheque(c.id, { amount: v })} />
                    </Field>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {method === "transfer" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("Transfer amount")}>
              <MoneyInput value={transfer.amount} onChange={(v) => setTransfer((p) => ({ ...p, amount: v }))} />
            </Field>
            <Field label={t("Account No")}>
              <Input value={transfer.accountNo} onChange={(e) => setTransfer((p) => ({ ...p, accountNo: e.target.value }))} />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}
