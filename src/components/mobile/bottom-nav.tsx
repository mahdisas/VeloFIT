"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Dumbbell, Home, ShoppingBag, User, type LucideIcon } from "lucide-react";

import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * veloFIT App navigation. Five tabs; only Home is functional today — the rest
 * route to "coming soon" placeholders. Rendered as a bottom bar on phones
 * (BottomNav) and as inline header tabs on desktop (TopNav).
 */
const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app/home", label: "Home", icon: Home },
  { href: "/app/upcoming", label: "Upcoming", icon: CalendarClock },
  { href: "/app/plans", label: "Plans", icon: Dumbbell },
  { href: "/app/shop", label: "Shop", icon: ShoppingBag },
  { href: "/app/profile", label: "Profile", icon: User },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Phone: fixed bottom tab bar. */
export function BottomNav({ className }: { className?: string }) {
  const t = useT();
  const isActive = useActive();

  return (
    <nav className={cn("shrink-0 border-t bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80", className)}>
      <ul className="flex items-stretch justify-around px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("size-5", active && "fill-primary/10")} />
                <span>{t(label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop: horizontal tabs inside the app header. */
export function TopNav({ className }: { className?: string }) {
  const t = useT();
  const isActive = useActive();

  return (
    <nav className={cn("items-center gap-1", className)}>
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            <span>{t(label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
