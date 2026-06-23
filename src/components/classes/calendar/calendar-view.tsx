"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  LayoutGrid,
  List,
  Plus,
  Square,
} from "lucide-react";

import { CalendarAgenda } from "@/components/classes/calendar/calendar-agenda";
import { CalendarMonth } from "@/components/classes/calendar/calendar-month";
import {
  CalendarRangeLoader,
  CalendarSessionsProvider,
} from "@/components/classes/calendar/calendar-sessions-context";
import { CalendarTimeGrid } from "@/components/classes/calendar/calendar-time-grid";
import { ClassDetailDialog } from "@/components/classes/calendar/class-detail-dialog";
import { QuickAddDialog } from "@/components/classes/calendar/quick-add-dialog";
import { ClassWizardDialog } from "@/components/classes/class-wizard-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  addDays,
  addMonths,
  type CalendarSession,
  type CalendarSessionMap,
  type CalendarView as ViewType,
  fromISO,
  toISO,
  weekDates,
} from "@/lib/calendar";
import { type IdName } from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// `mobile` views are the only ones offered on small screens (Day + Agenda);
// Month/Week are hidden below `sm` and the active view falls back to Agenda.
const VIEWS: { key: ViewType; label: string; Icon: typeof LayoutGrid; mobile: boolean }[] = [
  { key: "month", label: "Month", Icon: LayoutGrid, mobile: false },
  { key: "week", label: "Week", Icon: Columns3, mobile: false },
  { key: "day", label: "Day", Icon: Square, mobile: true },
  { key: "agenda", label: "Agenda", Icon: List, mobile: true },
];

export function CalendarView({
  initialDate,
  initialSessions,
  initialRange,
  kinds,
  trainers,
  classKinds,
  locations,
  groups,
  classPickerOptions,
}: {
  initialDate: string;
  initialSessions: CalendarSessionMap;
  initialRange: { start: string; end: string };
  kinds: IdName[];
  trainers: IdName[];
  classKinds: IdName[];
  locations: IdName[];
  groups: IdName[];
  classPickerOptions: IdName[];
}) {
  const t = useT();
  const today = React.useMemo(() => fromISO(initialDate), [initialDate]);
  const [view, setView] = React.useState<ViewType>("month");
  const [cursor, setCursor] = React.useState<Date>(() => fromISO(initialDate));
  const [selectedKinds, setSelectedKinds] = React.useState<string[]>(() => kinds.map((k) => k.id));
  const [showCanceled, setShowCanceled] = React.useState(false);
  const [quickAdd, setQuickAdd] = React.useState<{ open: boolean; date: Date | null }>({ open: false, date: null });
  const [detail, setDetail] = React.useState<{ open: boolean; session: CalendarSession | null; date: Date | null }>({ open: false, session: null, date: null });

  // On small screens only Day/Agenda are offered — fall back off Month/Week.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => {
      if (mq.matches) setView((v) => (v === "month" || v === "week" ? "agenda" : v));
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onQuickAdd = (date: Date) => setQuickAdd({ open: true, date });
  const onOpenDetail = (session: CalendarSession, date: Date) => setDetail({ open: true, session, date });

  const step = (dir: 1 | -1) => {
    if (view === "month") setCursor((c) => addMonths(c, dir));
    else if (view === "day") setCursor((c) => addDays(c, dir));
    else setCursor((c) => addDays(c, dir * 7)); // week & agenda
  };

  const days = view === "day" ? [cursor] : weekDates(cursor);

  return (
    <CalendarSessionsProvider initial={initialSessions} initialRange={initialRange}>
      {/* Keeps the cache warm for the visible window; refetches on navigation. */}
      <CalendarRangeLoader view={view} cursor={cursor} />
      <Card>
      <CardContent className="flex flex-col gap-4">
        {/* control bar */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <ClassWizardDialog
            trainers={trainers}
            classKinds={classKinds}
            locations={locations}
            groups={groups}
            onSaved={() => toast.success(t("Class added"))}
          >
            <Button><Plus className="size-4" /> {t("Add New Class")}</Button>
          </ClassWizardDialog>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("Class Kind")}</span>
            <KindFilter kinds={kinds} selected={selectedKinds} onChange={setSelectedKinds} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            {t("Show canceled classes")}
            <Switch checked={showCanceled} onCheckedChange={setShowCanceled} />
          </label>
        </div>

        {/* nav bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCursor(today)}>{t("Today")}</Button>
            {view !== "month" && (
              <Input type="date" value={toISO(cursor)} onChange={(e) => e.target.value && setCursor(fromISO(e.target.value))} className="w-40" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-primary" aria-label={t("Previous")} onClick={() => step(-1)}>
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </Button>
            <span className="min-w-40 text-center text-lg font-bold">{t(EN_MONTHS[cursor.getMonth()])} - {cursor.getFullYear()}</span>
            <Button variant="outline" size="icon" className="text-primary" aria-label={t("Next")} onClick={() => step(1)}>
              <ChevronRight className="size-5 rtl:rotate-180" />
            </Button>
          </div>

          <div className="inline-flex gap-1 rounded-md border p-1">
            {VIEWS.map(({ key, label, Icon, mobile }) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t(label)}
                    onClick={() => setView(key)}
                    className={cn(
                      "size-8 place-content-center rounded transition-colors",
                      mobile ? "grid" : "hidden sm:grid",
                      view === key ? "bg-primary/10 text-primary ring-1 ring-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t(label)}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* the view */}
        <div className="relative">
          {view === "month" && (
            <CalendarMonth cursor={cursor} today={today} kindFilter={selectedKinds} showCanceled={showCanceled} onQuickAdd={onQuickAdd} onOpenDetail={onOpenDetail} />
          )}
          {(view === "week" || view === "day") && (
            <CalendarTimeGrid days={days} long={view === "day"} kindFilter={selectedKinds} showCanceled={showCanceled} onQuickAdd={onQuickAdd} onOpenDetail={onOpenDetail} />
          )}
          {view === "agenda" && (
            <CalendarAgenda cursor={cursor} kindFilter={selectedKinds} showCanceled={showCanceled} onQuickAdd={onQuickAdd} onOpenDetail={onOpenDetail} />
          )}
        </div>
      </CardContent>

      {/* Sticky floating action button — stays visible while scrolling the grid.
          Sits above the support chat FAB (bottom-6) to avoid colliding with it. */}
      <button
        type="button"
        aria-label={t("Add new class")}
        onClick={() => onQuickAdd(cursor)}
        className="fixed end-8 bottom-24 z-50 grid size-14 place-content-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <Plus className="size-6" />
      </button>

      <QuickAddDialog
        open={quickAdd.open}
        onOpenChange={(o) => setQuickAdd((q) => ({ ...q, open: o }))}
        date={quickAdd.date}
        classOptions={classPickerOptions}
      />

      <ClassDetailDialog
        open={detail.open}
        onOpenChange={(o) => setDetail((d) => ({ ...d, open: o }))}
        session={detail.session}
        date={detail.date}
        trainers={trainers}
        classKinds={classKinds}
        locations={locations}
      />
    </Card>
    </CalendarSessionsProvider>
  );
}

/** Class-kind multi-checkbox filter with an "All" row. */
function KindFilter({
  kinds,
  selected,
  onChange,
}: {
  kinds: IdName[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const allSelected = selected.length === kinds.length && kinds.length > 0;

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const label = allSelected ? t("All") : selected.length === 0 ? t("None") : t("{n} selected", { n: selected.length });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-56 items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm"
      >
        <span>{label}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md">
          <Row checked={allSelected} onClick={() => onChange(allSelected ? [] : kinds.map((k) => k.id))} label={t("All")} />
          {kinds.map((k) => (
            <Row key={k.id} checked={selected.includes(k.id)} onClick={() => toggle(k.id)} label={k.name} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent/60"
    >
      <span className={cn("grid size-4 shrink-0 place-content-center rounded-[4px] border", checked ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
        {checked && <Check className="size-3.5" />}
      </span>
      <span dir="auto" className="flex-1">{label}</span>
    </div>
  );
}
