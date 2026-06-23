"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TimeField } from "@/components/ui/time-field";
import { addOneHour } from "@/lib/calendar";
import { DAY_NAMES, type TimeSlot, type WeeklyHours } from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const AXIS_TICKS = Array.from({ length: 13 }, (_, i) => i * 2); // 0,2,…,24

/** "HH:MM" → fraction of the 0–24 day (0…100). */
function pct(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h + (m || 0) / 60) / 24) * 100;
}

/** Step 3 — the weekly hours grid: a 0–24 track per day with editable blocks. */
export function ClassHoursEditor({
  value,
  onChange,
}: {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
}) {
  const t = useT();
  const [editing, setEditing] = React.useState<number | null>(null);

  const setDay = (day: number, slots: TimeSlot[]) =>
    onChange(value.map((s, i) => (i === day ? slots : s)));

  return (
    <div className="flex flex-col">
      <Axis />
      {DAY_NAMES.map((label, day) => (
        <div key={day} className="relative flex items-center gap-3 py-1.5">
          <div className="w-24 shrink-0 text-sm">{t(label)}</div>
          <div className="relative h-3 flex-1 rounded-full bg-muted">
            {value[day].map((slot, i) => {
              const left = pct(slot.from);
              const width = Math.max(0, pct(slot.to) - left);
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full rounded-full bg-primary"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${slot.from}–${slot.to}`}
                />
              );
            })}
          </div>
          <div className="flex w-14 shrink-0 items-center justify-end gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-7 text-primary" aria-label={`${t("Edit")} ${t(label)}`} onClick={() => setEditing((d) => (d === day ? null : day))}>
              <Pencil className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" aria-label={`${t("Clear")} ${t(label)}`} onClick={() => setDay(day, [])}>
              <Trash2 className="size-4" />
            </Button>
          </div>

          {editing === day && (
            <DayEditor
              slots={value[day]}
              onCommit={(slots) => setDay(day, slots)}
              onClose={() => setEditing(null)}
            />
          )}
        </div>
      ))}
      <Axis />
    </div>
  );
}

function Axis() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0" />
      <div className="flex flex-1 justify-between text-xs text-muted-foreground">
        {AXIS_TICKS.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="w-14 shrink-0" />
    </div>
  );
}

/** Anchored editor for one day's time blocks (From/To pairs + add). */
function DayEditor({
  slots,
  onCommit,
  onClose,
}: {
  slots: TimeSlot[];
  onCommit: (slots: TimeSlot[]) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [list, setList] = React.useState<TimeSlot[]>(slots.length ? slots : [{ from: "", to: "" }]);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      // The TimeField's Select dropdown is portaled outside this popover — a click
      // on an hour/minute option must NOT count as an outside click.
      if (target?.closest?.('[data-slot="select-content"], [data-radix-popper-content-wrapper]')) return;
      if (ref.current && !ref.current.contains(target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const commit = (next: TimeSlot[]) => {
    setList(next);
    onCommit(next.filter((s) => s.from && s.to));
  };

  const update = (idx: number, patch: Partial<TimeSlot>) =>
    commit(list.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  return (
    <div ref={ref} className="absolute top-full end-12 z-50 mt-1 w-80 rounded-md border bg-popover p-4 shadow-lg">
      <div className="flex flex-col gap-3">
        {list.map((slot, idx) => (
          <div key={idx} dir="ltr" className="grid grid-cols-2 gap-3">
            <Labeled label={t("From Hour")}>
              <TimeField
                value={slot.from}
                onChange={(v) => update(idx, v ? { from: v, to: addOneHour(v) } : { from: v })}
              />
            </Labeled>
            <Labeled label={t("To Hour")}>
              <TimeField value={slot.to} onChange={(v) => update(idx, { to: v })} />
            </Labeled>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Button
          type="button"
          size="icon"
          className="size-8 rounded-full"
          aria-label={t("Add time block")}
          onClick={() => commit([...list, { from: "", to: "" }])}
        >
          <Plus className="size-4" />
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("Cancel")}
        </Button>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
