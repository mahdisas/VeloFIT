import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { signOut } from "@/app/(app)/auth-actions";
import { BrandLogo } from "@/components/layout/brand";
import { PortalCards } from "@/components/portal/portal-cards";
import { Button } from "@/components/ui/button";
import { getGymIdentity } from "@/lib/business-server";
import { getT } from "@/lib/i18n/server";
import { isCurrentUserPlatformAdmin } from "@/lib/platform-admin";

export const metadata: Metadata = { title: "Choose a workspace" };

/**
 * Post-login gateway. Instead of dropping straight into the heavy desktop
 * dashboard, the user picks where to go: the desktop Control Panel (the full
 * admin app under /dashboard) or the mobile-first veloFIT App (/app/home).
 * Auth is enforced by getGymIdentity → getAuthedProfile (and the proxy).
 */
export default async function PortalPage() {
  const t = await getT();
  const [gym, isPlatformAdmin] = await Promise.all([getGymIdentity(), isCurrentUserPlatformAdmin()]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* Soft brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 start-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]"
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between gap-4 p-5 md:p-6">
        <BrandLogo />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
            <LogOut className="size-4" /> {t("Sign out")}
          </Button>
        </form>
      </header>

      {/* Chooser */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("Welcome back{name}", { name: gym.name ? `, ${gym.name}` : "" })}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("Where would you like to go?")}</p>

          <PortalCards isPlatformAdmin={isPlatformAdmin} />
        </div>
      </main>
    </div>
  );
}
