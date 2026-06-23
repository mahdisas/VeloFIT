"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";

import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type Option = { id: string; name: string };

/**
 * Multi-select with chips in the trigger and a checkbox dropdown panel.
 * Mirrors the "Classes" picker in the group drawer. Self-contained (no Popover
 * primitive in the kit) — anchors a panel under the trigger and closes on
 * outside-click / Escape.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "",
}: {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const t = useT();
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

  const selected = options.filter((o) => value.includes(o.id));

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div ref={rootRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen((o) => !o))}
        className={cn(
          "flex min-h-9 w-full cursor-pointer items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1 text-sm transition-colors",
          open ? "border-ring ring-3 ring-ring/30" : "hover:border-ring/60"
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {selected.length === 0 ? (
            <span className="px-1 text-muted-foreground">{placeholder}</span>
          ) : (
            selected.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 py-0.5 pe-1 ps-2 text-xs text-primary"
                dir="auto"
              >
                {o.name}
                <button
                  type="button"
                  aria-label={t("Remove {name}", { name: o.name })}
                  onClick={(e) => { e.stopPropagation(); toggle(o.id); }}
                  className="grid size-4 place-content-center rounded-full bg-primary/15 text-primary hover:bg-primary/25"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))
          )}
        </div>

        {open && selected.length > 0 && (
          <button
            type="button"
            aria-label={t("Clear all")}
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
            className="grid size-5 shrink-0 place-content-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {options.map((o) => {
            const checked = value.includes(o.id);
            return (
              <div
                key={o.id}
                role="button"
                tabIndex={0}
                onClick={() => toggle(o.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(o.id))}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-start text-sm transition-colors outline-none",
                  checked ? "bg-accent" : "hover:bg-accent/60"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4 shrink-0 place-content-center rounded-[4px] border transition-colors",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  )}
                >
                  {checked && <Check className="size-3.5" />}
                </span>
                <span dir="auto" className="flex-1">{o.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
