"use client";

import * as React from "react";
import { CirclePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/provider";

export type LineItem = { id: string; label: string; qty: number; unitPrice: number };

/**
 * The "Items" table (Items / Quantity / Unit price / Total + add-row) plus the
 * right-aligned grand Total. Shared by the subscription wizard and the
 * accounting document forms. Owns its own rows; reports the running total.
 */
export function InvoiceItems({
  defaultLabel = "",
  defaultUnitPrice = 0,
  onTotalChange,
  onItemsChange,
}: {
  defaultLabel?: string;
  defaultUnitPrice?: number;
  onTotalChange?: (total: number) => void;
  /** Reports the named line items (empty-label rows dropped) for persistence. */
  onItemsChange?: (items: LineItem[]) => void;
}) {
  const t = useT();
  const [items, setItems] = React.useState<LineItem[]>([
    { id: "li-1", label: defaultLabel, qty: 1, unitPrice: defaultUnitPrice },
  ]);

  const total = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

  React.useEffect(() => {
    onTotalChange?.(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  React.useEffect(() => {
    onItemsChange?.(items.filter((it) => it.label.trim() !== ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addItem = () =>
    setItems((prev) => [...prev, { id: `li-${prev.length + 1}-${Date.now()}`, label: "", qty: 1, unitPrice: 0 }]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="hidden grid-cols-[1fr_5rem_6rem_6rem_2rem] gap-3 text-sm font-medium text-[#595959] md:grid">
          <span>{t("Items")} <span className="text-destructive">*</span></span>
          <span>{t("Quantity")} <span className="text-destructive">*</span></span>
          <span>{t("Unit price")} <span className="text-destructive">*</span></span>
          <span>{t("Total")}</span>
          <span />
        </div>
        {items.map((it, idx) => (
          <div
            key={it.id}
            className="grid grid-cols-1 gap-x-3 gap-y-2 rounded-lg border p-3 md:grid-cols-[1fr_5rem_6rem_6rem_2rem] md:items-center md:gap-y-3 md:rounded-none md:border-0 md:p-0"
          >
            {/* The header row is md-only, so each field carries its own label on
                small screens (md:contents keeps the desktop grid identical). */}
            <Field label={`${t("Items")} *`}>
              <Input placeholder={t("Type...")} value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} />
            </Field>
            <Field label={`${t("Quantity")} *`}>
              <Input type="number" min={0} value={it.qty} onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) || 0 })} />
            </Field>
            <Field label={`${t("Unit price")} *`}>
              <Input type="number" min={0} value={it.unitPrice} onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value) || 0 })} />
            </Field>
            <Field label={t("Total")}>
              <Input value={(it.qty * it.unitPrice).toFixed(0)} readOnly className="bg-muted/50" />
            </Field>
            {idx === items.length - 1 ? (
              <Button type="button" variant="ghost" size="icon" className="justify-self-start text-primary md:justify-self-auto" aria-label={t("Add item")} onClick={addItem}>
                <CirclePlus className="size-5" />
              </Button>
            ) : (
              <span className="hidden md:block" />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[#595959]">{t("Total")}</span>
          <Input value={total.toFixed(0)} readOnly className="w-40 bg-muted/50" />
        </div>
      </div>
    </div>
  );
}

/**
 * One line-item field. On phones it stacks a label over its input; on md+ the
 * wrapper collapses (display: contents) so the input drops straight into the
 * shared grid and the (md-only) column header provides the title instead.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 md:contents">
      <span className="text-xs font-medium text-[#595959] md:hidden">{label}</span>
      {children}
    </label>
  );
}
