"use client";

import Link from "next/link";
import {
  ChevronDown,
  Landmark,
  LayoutGrid,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Power,
} from "lucide-react";

import { signOut } from "@/app/(app)/auth-actions";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ClientSearch } from "@/components/layout/client-search";
import { type GymIdentity } from "@/lib/business";
import { useT } from "@/lib/i18n/provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TopbarProps = {
  gym: GymIdentity;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
};

export function Topbar({ gym, collapsed, onToggleSidebar, onOpenMobileNav }: TopbarProps) {
  const t = useT();
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card px-4 md:gap-4 md:px-6">
      {/* Mobile nav trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMobileNav}
        aria-label={t("Open navigation")}
      >
        <Menu className="size-5" />
      </Button>

      {/* Desktop sidebar collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden text-muted-foreground md:inline-flex"
        onClick={onToggleSidebar}
        aria-label={collapsed ? t("Expand sidebar") : t("Collapse sidebar")}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-5" />
        ) : (
          <PanelLeftClose className="size-5" />
        )}
      </Button>

      {/* Global client search (live results) */}
      <ClientSearch />

      <div className="ms-auto flex items-center gap-0.5 md:gap-1">
        {/* Back to the post-login gateway (Control Panel ↔ veloFIT App). */}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
        >
          <Link href="/portal" aria-label={t("Main menu")} title={t("Main menu")}>
            <LayoutGrid className="size-5" />
          </Link>
        </Button>

        <LanguageSwitcher className="text-muted-foreground" />

        {/* Profile / business menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 flex items-center gap-2 rounded-full py-1 pr-2 pl-1 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:ml-2">
            <Avatar className="size-8">
              <AvatarImage src={gym.logoUrl ?? undefined} alt={gym.name} />
              <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
                {gym.name.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium md:inline" dir="auto">{gym.name}</span>
            <ChevronDown className="hidden size-4 text-muted-foreground md:inline" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-0">
            {/* Gym + log out */}
            <div className="flex items-center gap-3 p-3">
              <Avatar className="size-9">
                <AvatarImage src={gym.logoUrl ?? undefined} alt={gym.name} />
                <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
                  {gym.name.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate text-sm font-medium" dir="auto">
                {gym.name}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label={t("Log out")}
                  className="grid size-8 shrink-0 place-content-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                >
                  <Power className="size-4" />
                </button>
              </form>
            </div>
            <DropdownMenuSeparator className="my-0" />
            <div className="p-1">
              <DropdownMenuItem asChild>
                <Link href="/portal" className="cursor-pointer">
                  <LayoutGrid className="size-4" /> {t("Main menu")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/business-details" className="cursor-pointer">
                  <Landmark className="size-4" /> {t("Business details")}
                </Link>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
