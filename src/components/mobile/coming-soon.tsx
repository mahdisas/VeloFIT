"use client";

import { CalendarClock, Dumbbell, ShoppingBag, User, type LucideIcon } from "lucide-react";

import { useT } from "@/lib/i18n/provider";

/**
 * Placeholder for the not-yet-built mobile tabs. Takes a serializable `tab`
 * string (not an icon component) so the route pages can stay Server Components —
 * a function/component prop can't cross the server→client boundary.
 */
type Tab = "upcoming" | "plans" | "shop" | "profile";

const META: Record<Tab, { icon: LucideIcon; label: string }> = {
  upcoming: { icon: CalendarClock, label: "Upcoming" },
  plans: { icon: Dumbbell, label: "Plans" },
  shop: { icon: ShoppingBag, label: "Shop" },
  profile: { icon: User, label: "Profile" },
};

export function ComingSoon({ tab }: { tab: Tab }) {
  const t = useT();
  const { icon: Icon, label } = META[tab];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="grid size-20 place-content-center rounded-3xl bg-primary/10 text-primary">
        <Icon className="size-9" />
      </div>
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold">{t(label)}</h1>
        <p className="text-sm text-muted-foreground">{t("Coming soon")}</p>
      </div>
    </div>
  );
}
