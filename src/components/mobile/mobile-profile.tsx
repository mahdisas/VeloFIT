"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, Mail, MapPin, Phone, User } from "lucide-react";

import { SubscriptionCard } from "@/components/mobile/subscription-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { setLocale } from "@/lib/i18n/actions";
import { dirFor, LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/config";
import { initials } from "@/lib/clients";
import { type GymInfo, type MobileProfile as Profile, type MobileSubscription } from "@/lib/mobile-server";
import { useLocale, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Profile screen — the viewer's photo + details, then either their memberships
 * (members) or the gym's details (staff/owner), and a language selector
 * (cookie-backed, applies RTL immediately).
 */
export function MobileProfile({
  profile,
  subscriptions,
  isMember = false,
  gym = null,
}: {
  profile: Profile;
  subscriptions: MobileSubscription[];
  isMember?: boolean;
  gym?: GymInfo | null;
}) {
  const t = useT();
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const choose = (locale: Locale) => {
    if (locale === current) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-full flex-col gap-7 px-4 py-6">
      {/* Avatar */}
      <div className="flex justify-center pt-4">
        <Avatar className="size-28 ring-4 ring-primary/10">
          <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.fullName} />
          <AvatarFallback className="bg-primary/10 text-3xl font-semibold text-primary">
            <span dir="auto">{initials(profile.fullName)}</span>
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Details — Name + Phone */}
      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold">{t("Details")}</h2>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <DetailRow icon={<User className="size-5" />} label={t("Name")} value={profile.fullName} valueDir="auto" />
          {profile.phone && (
            <DetailRow icon={<Phone className="size-5" />} label={t("Phone")} value={profile.phone} valueDir="ltr" />
          )}
        </div>
      </section>

      {/* Members: their memberships · Staff: the gym's details */}
      {isMember ? (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-sm font-semibold">{t("Subscriptions")}</h2>
          {subscriptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("No active subscriptions")}
            </div>
          ) : (
            subscriptions.map((s) => <SubscriptionCard key={s.id} subscription={s} />)
          )}
        </section>
      ) : (
        gym && (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-sm font-semibold">{t("Gym details")}</h2>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <DetailRow icon={<Building2 className="size-5" />} label={t("Name")} value={gym.name} valueDir="auto" />
              <DetailRow icon={<KeyRound className="size-5" />} label={t("Gym Code")} value={gym.code} valueDir="ltr" />
              {gym.phone && <DetailRow icon={<Phone className="size-5" />} label={t("Phone")} value={gym.phone} valueDir="ltr" />}
              {gym.email && <DetailRow icon={<Mail className="size-5" />} label={t("Email")} value={gym.email} valueDir="ltr" />}
              {gym.address && <DetailRow icon={<MapPin className="size-5" />} label={t("Address")} value={gym.address} valueDir="auto" />}
            </div>
          </section>
        )
      )}

      {/* Language — pinned to the bottom */}
      <section className="mt-auto flex flex-col gap-2.5 pt-2">
        <h2 className="text-sm font-semibold">{t("Language")}</h2>
        <div className="flex gap-2">
          {LOCALES.map((locale) => {
            const active = locale === current;
            return (
              <button
                key={locale}
                type="button"
                disabled={pending}
                onClick={() => choose(locale)}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60",
                  active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {LOCALE_LABELS[locale]}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** One labelled row inside a details card (icon badge + label + value). */
function DetailRow({
  icon,
  label,
  value,
  valueDir,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueDir: "ltr" | "auto";
}) {
  return (
    <div className="flex items-center gap-3 p-4 [&:not(:first-child)]:border-t">
      <span className="grid size-10 shrink-0 place-content-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-medium" dir={valueDir}>{value}</p>
      </div>
    </div>
  );
}
