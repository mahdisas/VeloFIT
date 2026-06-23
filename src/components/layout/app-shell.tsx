"use client";

import * as React from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type GymIdentity } from "@/lib/business";
import { dirFor } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/provider";

const SIDEBAR_STORAGE_KEY = "velofit:sidebar-collapsed";

/**
 * Application chrome: fixed sidebar + topbar, scrollable content area.
 * Desktop sidebar collapses to an icon rail (persisted in localStorage);
 * on mobile the same sidebar renders inside a slide-over Sheet.
 */
export function AppShell({ gym, children }: { gym: GymIdentity; children: React.ReactNode }) {
  const t = useT();
  // In RTL the sidebar lives on the right, so the mobile drawer slides from there.
  const isRtl = dirFor(useLocale()) === "rtl";
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Restore the persisted collapse preference after hydration.
  React.useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, prev ? "0" : "1");
      return !prev;
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh overflow-hidden bg-background">
        {/* Desktop sidebar (flips to the right in RTL via flex; border-e keeps the
            divider on the content-facing edge in both directions). */}
        <div className="hidden border-e md:block">
          <Sidebar gym={gym} collapsed={collapsed} />
        </div>

        {/* Mobile sidebar — slides from the right in RTL, the left in LTR. */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side={isRtl ? "right" : "left"} className="w-64 p-0 md:hidden">
            <SheetTitle className="sr-only">{t("Navigation")}</SheetTitle>
            <Sidebar gym={gym} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            gym={gym}
            collapsed={collapsed}
            onToggleSidebar={toggleSidebar}
            onOpenMobileNav={() => setMobileOpen(true)}
          />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
