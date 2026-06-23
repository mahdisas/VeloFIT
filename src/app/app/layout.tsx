import Link from "next/link";
import { LayoutGrid } from "lucide-react";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { BottomNav, TopNav } from "@/components/mobile/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getGymIdentity } from "@/lib/business-server";

/**
 * veloFIT App shell — responsive, and deliberately separate from the desktop
 * AppShell (no sidebar/topbar). On phones it's a full-height column with a fixed
 * bottom tab bar; on desktop the tabs move into the header and the content sits
 * in a wider centered column. Auth is enforced via getGymIdentity →
 * getAuthedProfile.
 */
export default async function MobileAppLayout({ children }: { children: React.ReactNode }) {
  const gym = await getGymIdentity();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      {/* App header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="veloFIT" className="size-8 shrink-0 rounded-lg object-cover" />
          <span className="truncate font-heading text-base font-semibold" dir="auto">
            {gym.name || "veloFIT"}
          </span>
        </div>

        {/* Desktop tabs live in the header; the bottom bar is phone-only. */}
        <TopNav className="hidden md:flex" />

        <div className="flex shrink-0 items-center gap-0.5">
          {/* Language selector (the mobile shell has no AppShell TooltipProvider). */}
          <TooltipProvider>
            <LanguageSwitcher />
          </TooltipProvider>

          {/* Back to the gateway (switch to the desktop Control Panel). */}
          <Link
            href="/portal"
            aria-label="Switch workspace"
            className="grid size-9 shrink-0 place-content-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LayoutGrid className="size-5" />
          </Link>
        </div>
      </header>

      {/* Scrollable content — narrow on phones, wider centered column on desktop. */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">{children}</div>
      </main>

      <BottomNav className="md:hidden" />
      <Toaster richColors position="top-center" />
    </div>
  );
}
