"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserPlatformAdmin } from "@/lib/platform-admin";

/**
 * After the client signs in on /admin/login, confirm the session belongs to a
 * platform super-admin (email in PLATFORM_ADMIN_EMAILS). The form signs the user
 * back out if this returns false — a non-admin never reaches the console.
 */
export async function checkPlatformAdmin(): Promise<boolean> {
  return isCurrentUserPlatformAdmin();
}

/** Sign the operator out of the console and return to the admin login. */
export async function adminSignOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
