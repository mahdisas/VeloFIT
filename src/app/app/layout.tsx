import Link from "next/link";
import { LayoutGrid } from "lucide-react";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { AppDrawer } from "@/components/mobile/app-drawer";
import { BottomNav, TopNav } from "@/components/mobile/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAppViewer } from "@/lib/app-viewer";
import { getGymName, getViewerProfile } from "@/lib/mobile-server";

/**
 * veloFIT App shell. Works for both staff (cookie session) and members (the
 * temporary phone+code session) via getAppViewer — members get the same chrome
 * minus the staff-only "switch workspace" gateway, and a member-aware sign-out.
 */
export default async function MobileAppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAppViewer();
  const [me, gymName] = await Promise.all([getViewerProfile(viewer), getGymName(viewer)]);
  const isMember = viewer.kind === "member";

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <AppDrawer userName={me.fullName} avatarUrl={me.avatarUrl} gymName={gymName || "veloFIT"} isMember={isMember} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="veloFIT" className="size-8 shrink-0 rounded-lg object-cover" />
          <span className="truncate font-heading text-base font-semibold" dir="auto">
            {gymName || "veloFIT"}
          </span>
        </div>

        {/* Desktop tabs live in the header; the bottom bar is phone-only. */}
        <TopNav className="hidden md:flex" />

        <div className="flex shrink-0 items-center gap-0.5">
          <TooltipProvider>
            <LanguageSwitcher />
          </TooltipProvider>

          {/* Staff can hop to the desktop Control Panel; members only have the app. */}
          {!isMember && (
            <Link
              href="/portal"
              aria-label="Switch workspace"
              className="grid size-9 shrink-0 place-content-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LayoutGrid className="size-5" />
            </Link>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">{children}</div>
      </main>

      <BottomNav className="md:hidden" />
      <Toaster richColors position="top-center" />
    </div>
  );
}
