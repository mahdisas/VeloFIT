"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Activity, Clock, Loader2, LogOut, Menu } from "lucide-react";

import { signOut } from "@/app/(app)/auth-actions";
import { memberSignOut } from "@/app/login/member-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { initials } from "@/lib/clients";
import { dirFor } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * Side menu (hamburger drawer) for the veloFIT app. Header shows the signed-in
 * staff member over the gym name; the menu links to the class History screen and
 * offers the standard sign-out. Opens from a top-app-bar icon.
 */
export function AppDrawer({
  userName,
  avatarUrl,
  gymName,
  isMember = false,
}: {
  userName: string;
  avatarUrl: string | null;
  gymName: string;
  isMember?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  // The hamburger sits at the start of the top bar, so the drawer slides in from
  // that same side: left in LTR, right in RTL.
  const side = dirFor(useLocale()) === "rtl" ? "right" : "left";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("Menu")}
          className="grid size-9 shrink-0 place-content-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>

      <SheetContent side={side} className="flex w-80 flex-col gap-0 p-0">
        <SheetHeader className="flex flex-row items-center gap-3 border-b p-5 text-start space-y-0">
          <Avatar className="size-12">
            <AvatarImage src={avatarUrl ?? undefined} alt={userName} />
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              <span dir="auto">{initials(userName)}</span>
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <SheetTitle className="truncate text-base" dir="auto">{userName}</SheetTitle>
            <SheetDescription className="truncate" dir="auto">{gymName}</SheetDescription>
          </div>
        </SheetHeader>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          <Link
            href="/app/history"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {isMember ? <Clock className="size-5 text-muted-foreground" /> : <Activity className="size-5 text-muted-foreground" />}
            {isMember ? t("History") : t("Activity")}
          </Link>
        </nav>

        <div className="border-t p-3">
          <form action={isMember ? memberSignOut : signOut}>
            <SignOutButton label={t("Log out")} pendingLabel={t("Signing out…")} />
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The drawer's sign-out submit. Lives inside the <form> so useFormStatus can
 * show a spinner while the server action runs — signing out isn't instant, and
 * without feedback the button feels dead.
 */
function SignOutButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-70"
    >
      {pending ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />}
      {pending ? pendingLabel : label}
    </button>
  );
}
