"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { money } from "@/lib/reports/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

/** The product's first year of operation — the year filter starts here. */
const LAUNCH_YEAR = 2024;
// Years from launch through next year (so end-of-year forward-dated docs are
// selectable). Recomputed per render-tree load, so it never goes stale.
const YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() + 1 - LAUNCH_YEAR + 1 },
  (_, i) => String(LAUNCH_YEAR + i)
).map((y) => ({ value: y, label: y }));

/** Year-and-month OR date-range filter. Returns its UI + a date predicate. */
export function usePeriodFilter(defaults?: { year?: string; month?: string }) {
  const t = useT();
  const [mode, setMode] = React.useState<"month" | "range">("month");
  const [year, setYear] = React.useState(defaults?.year ?? "2025");
  const [month, setMonth] = React.useState(defaults?.month ?? "6");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const matches = React.useCallback(
    (iso: string) => {
      const d = iso.slice(0, 10);
      if (mode === "month") {
        const [y, m] = d.split("-");
        return y === year && Number(m) === Number(month);
      }
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    },
    [mode, year, month, from, to]
  );

  const node = (
    <div className="flex flex-col gap-4">
      <RadioGroup value={mode} onValueChange={(v) => setMode(v as "month" | "range")} className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="month" /> {t("Search by year and month")}</label>
        <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="range" /> {t("Search by date range")}</label>
      </RadioGroup>
      {mode === "month" ? (
        <div className="flex flex-wrap gap-4">
          <FilterSelect label="Year" value={year} onChange={setYear} options={YEAR_OPTIONS} className="w-full sm:w-36" />
          <FilterSelect label="Month" value={month} onChange={setMonth} options={MONTH_OPTIONS} className="w-full sm:w-44" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          <FilterField label="From date" className="w-full sm:w-44"><Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-44"><Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
        </div>
      )}
    </div>
  );

  return { node, matches };
}

/**
 * URL-driven period filter for the SERVER-side finance reports: a radio between
 * "Search by year and month" (default — two selects) and "Search by date range"
 * (from/to pickers). Month mode writes the month's exact bounds into from/to, so
 * the report RPCs need no new parameters; range mode sets mode=range in the URL
 * so the server stops defaulting to the current month.
 */
export function PeriodFilterControls({
  mode,
  from,
  to,
  navigate,
}: {
  mode: "month" | "range";
  from: string;
  to: string;
  navigate: (patch: Record<string, string | null>) => void;
}) {
  const t = useT();
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const base = /^\d{4}-\d{2}/.test(from) ? from : `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const year = base.slice(0, 4);
  const month = String(Number(base.slice(5, 7)));

  const gotoMonth = (y: string, m: string) => {
    const last = new Date(Number(y), Number(m), 0).getDate();
    navigate({ mode: null, from: `${y}-${pad(Number(m))}-01`, to: `${y}-${pad(Number(m))}-${pad(last)}` });
  };

  return (
    <div className="flex flex-col items-start gap-4">
      <RadioGroup
        value={mode}
        onValueChange={(v) => (v === "month" ? gotoMonth(year, month) : navigate({ mode: "range", from: null, to: null }))}
        className="flex flex-wrap gap-6"
      >
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="month" /> {t("Search by year and month")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="range" /> {t("Search by date range")}
        </label>
      </RadioGroup>
      {mode === "month" ? (
        <div className="flex flex-wrap gap-4">
          <FilterSelect label="Year" value={year} onChange={(y) => gotoMonth(y, month)} options={YEAR_OPTIONS} className="w-full sm:w-36" />
          <FilterSelect label="Month" value={month} onChange={(m) => gotoMonth(year, m)} options={MONTH_OPTIONS} className="w-full sm:w-44" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          <FilterField label="From date" className="w-full sm:w-44">
            <Input type="date" className="h-11" value={from} onChange={(e) => navigate({ mode: "range", from: e.target.value || null })} />
          </FilterField>
          <FilterField label="To date" className="w-full sm:w-44">
            <Input type="date" className="h-11" value={to} onChange={(e) => navigate({ mode: "range", to: e.target.value || null })} />
          </FilterField>
        </div>
      )}
    </div>
  );
}

/** Multi-checkbox filter with an "All" row. Returns its UI + a predicate. */
export function useMultiCheckboxFilter(label: string, options: string[], width = "sm:w-96") {
  const t = useT();
  const [selected, setSelected] = React.useState<string[]>(options);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const allSelected = selected.length === options.length;

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const matches = React.useCallback((value: string) => selected.includes(value), [selected]);

  const toggle = (t: string) =>
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const summary = allSelected ? options.map((o) => t(o)).join(", ") : selected.length === 0 ? t("None") : selected.map((o) => t(o)).join(", ");

  const node = (
    <div ref={ref} className={cn("relative w-full", width)}>
      <label className="absolute -top-2 start-2.5 z-10 max-w-[calc(100%-1rem)] truncate bg-card px-1 text-xs text-muted-foreground">{t(label)}</label>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm">
        <span className="truncate">{summary}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          <Row checked={allSelected} onClick={() => setSelected(allSelected ? [] : [...options])} label={t("All")} />
          {options.map((opt) => (
            <Row key={opt} checked={selected.includes(opt)} onClick={() => toggle(opt)} label={t(opt)} />
          ))}
        </div>
      )}
    </div>
  );

  return { node, matches };
}

/** "Document type" multi-checkbox (finance document reports). */
export function useDocumentTypeFilter(types: string[]) {
  return useMultiCheckboxFilter("Document type", types);
}

function Row({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())} className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent/60">
      <span className={cn("grid size-4 shrink-0 place-content-center rounded-[4px] border", checked ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
        {checked && <Check className="size-3.5" />}
      </span>
      <span dir="auto" className="flex-1">{label}</span>
    </div>
  );
}

/** The three blue invoice summary cards on the document reports. */
export function InvoiceCards({ receipts, withoutVat, withVat }: { receipts: number; withoutVat: number; withVat: number }) {
  const t = useT();
  const cards = [
    { label: "Total receipts", value: receipts },
    { label: "Total invoices without VAT", value: withoutVat },
    { label: "Total invoices with VAT", value: withVat },
  ];
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg bg-primary px-4 py-6 text-center text-primary-foreground shadow-lg shadow-primary/25">
          <div className="font-semibold">{t(c.label)}</div>
          <div className="mt-1 text-lg font-bold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

/** The four bordered payment-method summary cards on the payments reports. */
export function PaymentCards({ cash, creditCard, cheques, bankTransfer }: { cash: number; creditCard: number; cheques: number; bankTransfer: number }) {
  const t = useT();
  const cards = [
    { label: "Total cash", value: cash },
    { label: "Total credit card", value: creditCard },
    { label: "Total cheques", value: cheques },
    { label: "Total bank transfer", value: bankTransfer },
  ];
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border px-4 py-5 text-center">
          <div className="text-lg font-bold">{c.value}</div>
          <div className="text-sm font-medium">{t(c.label)}</div>
        </div>
      ))}
    </div>
  );
}

export { money };
