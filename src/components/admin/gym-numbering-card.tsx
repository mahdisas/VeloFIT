"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hash, Loader2 } from "lucide-react";

import { setDocNextNumber, type DocCounter, type DocType } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** DB doc_type → the label the finance UI already uses (all pre-translated). */
const TYPE_LABEL: Record<DocType, string> = {
  tax_invoice: "Tax invoice",
  receipt: "Receipt",
  receipt_tax_invoice: "Receipt tax invoice",
  refund: "Refund invoice",
  non_formal_transaction: "Non Formal Transaction",
  informal: "Informal",
  bid: "Bid",
};

/**
 * Admin · per-gym invoice sequencing. Each document type shows the number its
 * NEXT document will get; typing a new value seeds the gapless counter (raise-
 * only — the server rejects lowering, so issued numbers can't repeat).
 */
export function GymNumberingCard({ gymId, counters }: { gymId: string; counters: DocCounter[] }) {
  const t = useT();

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold">{t("Document numbering")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("The number the next document of each type will receive. Can only be raised.")}
        </p>
      </div>

      <div className="flex flex-col">
        {counters.map((c, i) => (
          // Keyed on the server value too: when a save refreshes the counters,
          // the row remounts with the new number (no state-sync effect needed).
          <CounterRow key={`${c.docType}-${c.nextNumber}`} gymId={gymId} counter={c} first={i === 0} />
        ))}
      </div>
    </section>
  );
}

function CounterRow({ gymId, counter, first }: { gymId: string; counter: DocCounter; first: boolean }) {
  const t = useT();
  const router = useRouter();
  const [value, setValue] = React.useState(String(counter.nextNumber));
  const [pending, startTransition] = React.useTransition();

  const dirty = Number(value) !== counter.nextNumber;

  const save = () => {
    const next = Number(value); // "0488" parses to 488
    if (!Number.isFinite(next) || next < 1) {
      toast.error(t("The next number must be at least 1."));
      return;
    }
    startTransition(async () => {
      const res = await setDocNextNumber(gymId, counter.docType, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("Numbering updated"));
      router.refresh();
    });
  };

  return (
    <div className={cn("flex items-center gap-3 py-2.5", !first && "border-t")}>
      <span className="grid size-9 shrink-0 place-content-center rounded-lg bg-primary/10 text-primary">
        <Hash className="size-4" />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{t(TYPE_LABEL[counter.docType])}</p>
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-28 text-end tabular-nums"
        dir="ltr"
        aria-label={t(TYPE_LABEL[counter.docType])}
      />
      <Button type="button" size="sm" variant={dirty ? "default" : "outline"} onClick={save} disabled={pending || !dirty}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : t("Set")}
      </Button>
    </div>
  );
}
