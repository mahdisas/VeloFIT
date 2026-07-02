"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PanelsTopLeft } from "lucide-react";

import { setGymPageHidden } from "@/app/admin/actions";
import { Switch } from "@/components/ui/switch";
import { HIDEABLE_NAV } from "@/lib/navigation";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Admin · per-gym page visibility. One switch per Control Panel section: ON =
 * the gym sees it in the sidebar, OFF = hidden (e.g. a gym that doesn't use
 * Workout Plans or the Archive). Dashboard and Settings are locked and never
 * listed. Hiding is decluttering, not a permission — direct URLs still work.
 */
export function GymPagesCard({ gymId, hiddenPages }: { gymId: string; hiddenPages: string[] }) {
  const t = useT();
  const router = useRouter();
  // Optimistic view of the hidden set — flips instantly, reverts on failure.
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set(hiddenPages));
  const [busyHref, setBusyHref] = React.useState<string | null>(null);

  const toggle = (href: string, title: string, show: boolean) => {
    setBusyHref(href);
    setHidden((prev) => {
      const next = new Set(prev);
      if (show) next.delete(href);
      else next.add(href);
      return next;
    });
    void (async () => {
      const res = await setGymPageHidden(gymId, href, !show);
      if (!res.ok) {
        toast.error(res.error);
        setHidden((prev) => {
          const next = new Set(prev);
          if (show) next.add(href);
          else next.delete(href);
          return next;
        });
      } else {
        toast.success(show ? t("{page} is now visible", { page: t(title) }) : t("{page} is now hidden", { page: t(title) }));
        router.refresh();
      }
      setBusyHref(null);
    })();
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-content-center rounded-lg bg-primary/10 text-primary">
          <PanelsTopLeft className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{t("Pages")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("Choose which sections this gym sees in its Control Panel.")}
          </p>
        </div>
      </div>

      <div className="flex flex-col">
        {HIDEABLE_NAV.map((page, i) => {
          const visible = !hidden.has(page.href);
          return (
            <label
              key={page.href}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 py-2.5",
                i > 0 && "border-t"
              )}
            >
              <span className={cn("text-sm font-medium", !visible && "text-muted-foreground line-through")}>
                {t(page.title)}
              </span>
              <Switch
                checked={visible}
                disabled={busyHref === page.href}
                onCheckedChange={(v) => toggle(page.href, page.title, v === true)}
                aria-label={t(page.title)}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
