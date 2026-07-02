"use client";

import { BadgeCheck, Ticket } from "lucide-react";

import { type SubscriptionPackage } from "@/lib/finance/packages";
import { vibrantColor } from "@/lib/mobile";
import { useT } from "@/lib/i18n/provider";

/** Shop · Membership — the gym's membership packages (the purchasable catalog). */
export function MobileMembership({ packages }: { packages: SubscriptionPackage[] }) {
  const t = useT();

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center text-muted-foreground">
        <BadgeCheck className="size-8" />
        <p className="text-sm">{t("No memberships available")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-5">
      {packages.map((p) => {
        const period = p.isClassPlan
          ? `${p.classesLimit ?? 0} ${t("Classes")}`
          : p.periodMonths === 1
            ? t("per month")
            : t("per {n} months", { n: p.periodMonths });
        const Icon = p.isClassPlan ? Ticket : BadgeCheck;
        return (
          <div key={p.id} className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
            <span
              className="grid size-14 shrink-0 place-content-center rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: vibrantColor(p.color) }}
            >
              <Icon className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold leading-tight" dir="auto">{p.name}</p>
              {p.groupName && <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground" dir="auto">{p.groupName}</p>}
            </div>
            <div className="shrink-0 text-end">
              <p className="text-lg font-bold tabular-nums">₪{p.price}</p>
              <p className="text-[11px] text-muted-foreground">{period}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
