"use client";

import * as React from "react";
import { Calendar } from "lucide-react";

import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Date input that always DISPLAYS the value as DD/MM/YYYY, regardless of the
 * browser/OS locale (a native <input type="date"> renders MM/DD/YYYY on en-US
 * systems and can't be restyled). A transparent native date input overlays the
 * field so clicking it still opens the browser's calendar picker; the formatted
 * DD/MM/YYYY text shows underneath.
 *
 * `value` / `onChange` speak ISO "yyyy-mm-dd" ("" = no date) — same contract as
 * a native date input, so it's a drop-in replacement.
 */
export function DateField({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  className,
  id,
  min,
  max,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  min?: string;
  max?: string;
}) {
  const display = value ? formatDate(value) : "";
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Clicking anywhere on the field opens the native calendar (clicking a
  // transparent date input alone doesn't reliably trigger it).
  const openPicker = () => inputRef.current?.showPicker?.();

  return (
    <div
      onClick={openPicker}
      className={cn(
        "relative flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        className
      )}
    >
      <span className={cn("flex-1 truncate", display ? "text-foreground" : "text-muted-foreground")}>
        {display || placeholder}
      </span>
      <Calendar className="size-4 shrink-0 text-muted-foreground" />
      {/* Transparent native picker on top — keeps the OS calendar, hides its text. */}
      <input
        ref={inputRef}
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </div>
  );
}
