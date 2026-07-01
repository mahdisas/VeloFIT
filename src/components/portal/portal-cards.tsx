"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutDashboard, Loader2, Shield, Smartphone } from "lucide-react";

import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * The two workspace cards on the gateway. Client-side so we can (a) prefetch both
 * destinations on mount and (b) show an instant spinner the moment one is tapped
 * — navigation into the heavy dashboard / app then feels immediate instead of
 * "nothing happened for a second".
 */
const CARDS = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "Control Panel",
    description: "Manage your gym — clients, finance, classes & reports.",
    cta: "Open Control Panel",
  },
  {
    href: "/app/home",
    icon: Smartphone,
    title: "veloFIT App",
    description: "Classes, bookings & attendance on the go.",
    cta: "Open veloFIT App",
  },
] as const;

const ADMIN_CARD = {
  href: "/admin",
  icon: Shield,
  title: "Admin Console",
  description: "Manage every gym — create gyms, users & billing.",
  cta: "Open Admin Console",
} as const;

export function PortalCards({ isPlatformAdmin = false }: { isPlatformAdmin?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [target, setTarget] = React.useState<string | null>(null);

  const cards = React.useMemo(
    () => (isPlatformAdmin ? [...CARDS, ADMIN_CARD] : [...CARDS]),
    [isPlatformAdmin]
  );

  // Warm all routes so the click navigates instantly in production.
  React.useEffect(() => {
    for (const c of cards) router.prefetch(c.href);
  }, [router, cards]);

  const go = (href: string) => {
    setTarget(href);
    startTransition(() => router.push(href));
  };

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {cards.map(({ href, icon: Icon, title, description, cta }) => {
        const loading = pending && target === href;
        return (
          <button
            key={href}
            type="button"
            onClick={() => go(href)}
            disabled={pending}
            className={cn(
              "group relative flex aspect-square flex-col justify-between overflow-hidden rounded-3xl border bg-card p-6 text-start shadow-sm transition-all",
              "hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            )}
          >
            <div className="grid size-16 place-content-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-heading text-xl font-semibold">{t(title)}</h2>
              <p className="text-sm text-muted-foreground">{t(description)}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              {cta && t(cta)}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </span>

            {loading && (
              <span className="absolute inset-0 grid place-content-center bg-card/70 backdrop-blur-sm">
                <Loader2 className="size-7 animate-spin text-primary" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
