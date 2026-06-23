"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { CLASS_COLORS } from "@/lib/classes";
import { cn } from "@/lib/utils";

/**
 * The class colour picker: a filled bar showing the current colour, opening a
 * swatch grid. Self-contained (no Popover primitive) — anchored panel that
 * closes on outside-click / Escape.
 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-end rounded-md px-2 text-white shadow-sm ring-1 ring-black/10"
        style={{ backgroundColor: value }}
        aria-label="Pick colour"
      >
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 shadow-md">
          <div className="grid grid-cols-8 gap-2">
            {CLASS_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className={cn(
                  "size-7 rounded-md ring-1 ring-black/10 transition-transform hover:scale-110",
                  value === c && "ring-2 ring-foreground ring-offset-1"
                )}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
