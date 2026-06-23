"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")); // 00,05,…,55

/** Snap any minute value to the nearest 5. */
function snap5(min: string): string {
  const n = Number(min) || 0;
  return String((Math.round(n / 5) * 5) % 60).padStart(2, "0");
}

/**
 * Time picker with a guaranteed 5-minute step. A native <input type="time"
 * step={300}> isn't reliable — browsers still list every minute in the picker —
 * so we own the options: an hour select + a 5-minute minute select. Value is
 * "HH:MM" (24h); incoming minutes are snapped to the nearest 5.
 */
export function TimeField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [hRaw = "00", mRaw = "00"] = (value || "").split(":");
  const h = HOURS.includes(hRaw) ? hRaw : "00";
  const m = MINUTES.includes(mRaw) ? mRaw : snap5(mRaw);
  const set = (hh: string, mm: string) => onChange(`${hh}:${mm}`);

  return (
    <div
      // Time always reads left-to-right (HH:MM), even on RTL pages.
      dir="ltr"
      className={cn(
        "flex h-8 items-center gap-0.5 rounded-lg border border-input bg-transparent pl-2 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        className
      )}
    >
      <Clock className="size-3.5 shrink-0 text-muted-foreground" />
      <Select value={h} onValueChange={(v) => set(v, m)}>
        <SelectTrigger aria-label="Hour" className="h-6 flex-1 justify-center border-0 px-1 shadow-none focus-visible:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-56 min-w-16">
          {HOURS.map((x) => (
            <SelectItem key={x} value={x}>{x}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={m} onValueChange={(v) => set(h, v)}>
        <SelectTrigger aria-label="Minute" className="h-6 flex-1 justify-center border-0 px-1 shadow-none focus-visible:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-56 min-w-16">
          {MINUTES.map((x) => (
            <SelectItem key={x} value={x}>{x}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
