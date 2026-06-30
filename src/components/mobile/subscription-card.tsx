"use client";

import { BadgeCheck, Ticket } from "lucide-react";

import { isNoExpiry } from "@/lib/clients";
import { formatDate } from "@/lib/format";
import { vibrantColor } from "@/lib/mobile";
import { type MobileSubscription } from "@/lib/mobile-server";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * One consolidated subscription block: a colored plan icon, the plan name + type,
 * then a split footer with Balance (remaining credits or the ₪ balance / "Paid")
 * and Expiry. Shared by the member Dashboard and Profile.
 */
export function SubscriptionCard({ subscription: s }: { subscription: MobileSubscription }) {
  const t = useT();
  const credits = s.classesLimit != null ? Math.max(0, s.classesLimit - s.classesUsed) : null;
  const owes = s.balance > 0.005;
  const Icon = s.isClassPlan ? Ticket : BadgeCheck;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-4 p-5">
        <span
          className="grid size-14 shrink-0 place-content-center rounded-2xl text-white shadow-sm"
          style={{ backgroundColor: vibrantColor(s.color) }}
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight" dir="auto">{s.planName}</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">{s.isClassPlan ? t("Class pass") : t("Membership")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t bg-muted/30">
        <div className="border-e p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("Balance")}</p>
          {s.isClassPlan && credits != null ? (
            <p className="font-semibold tabular-nums text-primary">{credits} {t("credits left")}</p>
          ) : (
            <p className={cn("font-semibold tabular-nums", owes ? "text-amber-600" : "text-emerald-600")}>
              {owes ? `₪${s.balance.toFixed(2)}` : t("Paid")}
            </p>
          )}
        </div>
        <div className="p-3 text-end">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("Expires")}</p>
          <p className="font-medium">{isNoExpiry(s.endDate) ? t("No Expiration") : formatDate(s.endDate)}</p>
        </div>
      </div>
    </div>
  );
}
