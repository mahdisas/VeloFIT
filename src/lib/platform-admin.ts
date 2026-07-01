import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdminEmail } from "@/lib/platform-admin-shared";

/**
 * Platform (super-admin) gate for the operator console at /admin.
 *
 * A super-admin is an ordinary authenticated user whose email is listed in the
 * PLATFORM_ADMIN_EMAILS env var (see lib/platform-admin-shared). This deliberately
 * has NO schema footprint: to grant access you add an email to the env and redeploy.
 *
 * The console works across tenants, so its reads/writes use the service-role
 * client (RLS-bypassing). That is safe ONLY because every console page and action
 * calls getPlatformAdmin() first — the proxy is a UX redirect, never the boundary
 * (same doctrine as lib/dal.ts::getAuthedProfile).
 */

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Require a signed-in platform super-admin. Returns the caller plus a service-role
 * client for cross-tenant work. Redirects to /login otherwise. Call at the top of
 * every /admin page and admin server action.
 */
export async function getPlatformAdmin(): Promise<{ userId: string; email: string; admin: AdminClient }> {
  const supabase = await createClient();

  let user = null;
  try {
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    user = null;
  }
  if (!user || !isPlatformAdminEmail(user.email)) redirect("/login");

  return { userId: user.id, email: user.email!, admin: createAdminClient() };
}

/** Non-redirecting check for the current session (e.g. to show the console entry). */
export async function isCurrentUserPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  let user = null;
  try {
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    user = null;
  }
  return isPlatformAdminEmail(user?.email);
}
