"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { BrandLogo } from "@/components/layout/brand";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type GymIdentity } from "@/lib/business";
import { useT } from "@/lib/i18n/provider";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarProps = {
  gym: GymIdentity;
  collapsed?: boolean;
  /** Invoked on any navigation — lets the mobile Sheet close itself. */
  onNavigate?: () => void;
};

export function Sidebar({ gym, collapsed = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  // Per-gym page visibility: the platform console can hide sections a gym
  // doesn't need (gyms.settings.hiddenPages). Decluttering, not security.
  const navItems = React.useMemo(
    () => NAV_ITEMS.filter((i) => !gym.hiddenPages.includes(i.href)),
    [gym.hiddenPages]
  );

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-(--sidebar-width-collapsed)" : "w-(--sidebar-width)"
      )}
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-collapsed": "4.5rem",
        } as React.CSSProperties
      }
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "px-5"
        )}
      >
        <Link href="/dashboard" onClick={onNavigate}>
          <BrandLogo compact={collapsed} />
        </Link>
      </div>

      {/* Active gym (tenant) */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-center gap-3 border-b border-sidebar-border py-3",
          collapsed ? "px-2" : "px-5"
        )}
      >
        <Avatar className="size-9 shrink-0">
          <AvatarImage src={gym.logoUrl ?? undefined} alt={gym.name} />
          <AvatarFallback className="bg-foreground font-semibold text-background">
            {gym.name.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <p className="truncate text-base font-semibold text-foreground" dir="auto">
            {gym.name}
          </p>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="min-h-0 flex-1">
        <nav className={cn("flex flex-col gap-0.5 py-3", collapsed ? "px-3" : "px-3")}>
          {navItems.map((item) =>
            item.children ? (
              <SidebarGroup
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ) : (
              <SidebarLink
                key={item.href}
                item={item}
                active={pathname.startsWith(item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            )
          )}
        </nav>
      </ScrollArea>
    </aside>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      {/* Active indicator bar, mirrors the reference UI */}
      {active && (
        <span className="absolute inset-y-1 -start-3 w-1 rounded-e-full bg-sidebar-primary" />
      )}
      <item.icon className="size-4.5 shrink-0" />
      {!collapsed && <span className="truncate">{t(item.title)}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{t(item.title)}</TooltipContent>
    </Tooltip>
  );
}

/** Collapsible nav group (Classes). Collapsed sidebar → right-side flyout menu. */
function SidebarGroup({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const groupActive = pathname.startsWith(item.href);

  if (collapsed) {
    return (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              className={cn(
                "relative flex items-center justify-center rounded-md px-2 py-2 outline-none transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                groupActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              )}
            >
              {groupActive && (
                <span className="absolute inset-y-1 -start-3 w-1 rounded-e-full bg-sidebar-primary" />
              )}
              <item.icon className="size-4.5" />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{t(item.title)}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="right" align="start" className="w-52">
          <DropdownMenuLabel>{t(item.title)}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.children!.map((child) => (
            <DropdownMenuItem key={child.href} asChild>
              <Link href={child.href} onClick={onNavigate}>
                <child.icon className="size-4" />
                {t(child.title)}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Collapsible defaultOpen={groupActive}>
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          groupActive
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-foreground"
        )}
      >
        <item.icon className="size-4.5 shrink-0" />
        <span className="flex-1 truncate text-start">{t(item.title)}</span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-closed:animate-collapsible-up data-open:animate-collapsible-down">
        <div className="mt-0.5 ms-4 flex flex-col gap-0.5 border-s border-sidebar-border ps-3">
          {item.children!.map((child) => {
            const active = pathname.startsWith(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground"
                )}
              >
                <child.icon className="size-4 shrink-0" />
                <span className="truncate">{t(child.title)}</span>
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
