import Link from "next/link";
import { LogOut, Shield } from "lucide-react";

import { adminSignOut } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { getPlatformAdmin } from "@/lib/platform-admin";

/**
 * Platform (super-admin) console shell. getPlatformAdmin() is the security gate —
 * it redirects any non-allowlisted user to the admin login before anything renders.
 * This layout wraps only the console pages; /admin/login sits outside it.
 */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const { email } = await getPlatformAdmin();
  const t = await getT();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
        <Link href="/admin" className="flex items-center gap-2 font-heading text-base font-semibold">
          <span className="grid size-8 place-content-center rounded-lg bg-primary/10 text-primary">
            <Shield className="size-4" />
          </span>
          {t("Admin Console")}
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline" dir="ltr">{email}</span>
          <form action={adminSignOut}>
            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
              <LogOut className="size-4" /> {t("Sign out")}
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
