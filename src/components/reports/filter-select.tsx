"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/**
 * The outlined, notched-floating-label frame used by every report filter
 * control. Wrap a SelectTrigger, a date Input, etc. Shared so report filter
 * bars look identical.
 */
export function FilterField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className={cn("relative", className)}>
      <label
        title={t(label)}
        className="absolute -top-2 start-2.5 z-10 max-w-[calc(100%-1rem)] truncate bg-card px-1 text-xs text-muted-foreground"
      >
        {t(label)}
      </label>
      {children}
    </div>
  );
}

/** Floating-label select — drops its menu directly below the box (popper). */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  muted,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  /** Render the trigger with a muted fill (matches the "Group" control). */
  muted?: boolean;
  className?: string;
}) {
  const t = useT();
  return (
    <FilterField label={label} className={className}>
      <Select value={value} onValueChange={onChange}>
        {/* Let the selected value fill the width and align by its OWN content
            direction (dir=auto + text-start), so an English group reads from the
            left and a Hebrew/Arabic group from the right, regardless of locale. */}
        <SelectTrigger
          className={cn(
            "h-11 w-full [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1",
            muted && "bg-muted"
          )}
        >
          <SelectValue placeholder={placeholder ? t(placeholder) : undefined} />
        </SelectTrigger>
        <SelectContent position="popper" align="start" sideOffset={4}>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              <span dir="auto" className="block w-full truncate text-start">{t(o.label)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
