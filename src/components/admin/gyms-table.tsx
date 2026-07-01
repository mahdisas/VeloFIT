"use client";

import Link from "next/link";
import { Building2, ChevronRight, UserRound, Users } from "lucide-react";

import { type GymRow } from "@/app/admin/actions";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** The platform's gyms as a tappable list; each row links to the gym detail page. */
export function GymsTable({ gyms }: { gyms: GymRow[] }) {
  const t = useT();

  if (gyms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-8 py-16 text-center text-muted-foreground">
        <Building2 className="size-8" />
        <p className="text-sm">{t("No gyms yet. Create the first one.")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {gyms.map((g) => (
        <Link
          key={g.id}
          href={`/admin/gyms/${g.id}`}
          className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
        >
          <span className="grid size-11 shrink-0 place-content-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold" dir="auto">{g.name}</p>
              {!g.isActive && (
                <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  {t("Suspended")}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">{g.code}</p>
          </div>
          <div className="hidden shrink-0 items-center gap-4 text-sm text-muted-foreground sm:flex">
            <span className="inline-flex items-center gap-1.5" title={t("Users")}>
              <UserRound className="size-4" /> {g.userCount}
            </span>
            <span className="inline-flex items-center gap-1.5" title={t("Members")}>
              <Users className="size-4" /> {g.memberCount}
            </span>
          </div>
          <ChevronRight className={cn("size-5 shrink-0 text-muted-foreground rtl:rotate-180")} />
        </Link>
      ))}
    </div>
  );
}
