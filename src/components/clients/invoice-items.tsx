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
}: {
  defaultLabel?: string;
  defaultUnitPrice?: number;
  onTotalChange?: (total: number) => void;
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
          <div key={it.id} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_5rem_6rem_6rem_2rem] md:items-center">
            <Input placeholder={t("Type...")} value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} />
            <Input type="number" min={0} value={it.qty} onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) || 0 })} />
            <Input type="number" min={0} value={it.unitPrice} onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value) || 0 })} />
            <Input value={(it.qty * it.unitPrice).toFixed(0)} readOnly className="bg-muted/50" />
            {idx === items.length - 1 ? (
              <Button type="button" variant="ghost" size="icon" className="text-primary" aria-label={t("Add item")} onClick={addItem}>
                <CirclePlus className="size-5" />
              </Button>
            ) : (
              <span />
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
