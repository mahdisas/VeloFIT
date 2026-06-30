"use client";

import * as React from "react";

import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type TopTab = { value: string; label: string; content: React.ReactNode };

/**
 * Pill-style sub-navigation for a mobile screen (e.g. Dashboard | Schedules).
 * Server pages pass each tab's pre-rendered content as a ReactNode; only the
 * active panel is mounted. The bar sticks to the top of the scroll area.
 */
export function MobileTopTabs({ tabs }: { tabs: TopTab[] }) {
  const t = useT();
  const [active, setActive] = React.useState(tabs[0]?.value);
  const current = tabs.find((x) => x.value === active) ?? tabs[0];

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 border-b bg-background/95 px-3 py-2 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1" role="tablist">
          {tabs.map((tab) => {
            const isActive = tab.value === current?.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(tab.value)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(tab.label)}
              </button>
            );
          })}
        </div>
      </div>
      <div>{current?.content}</div>
    </div>
  );
}
