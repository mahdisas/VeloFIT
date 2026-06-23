"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { GYM_CODE_COOKIE } from "@/lib/auth";
import { PERSIST_COOKIE } from "@/lib/supabase/persistence";

/**
 * Secure staff sign-out. Ends the Supabase session (clears the httpOnly auth
 * cookies server-side), drops the gym-code tenant hint, then sends the user
 * back to the login screen.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(GYM_CODE_COOKIE);
  cookieStore.delete(PERSIST_COOKIE);

  redirect("/login");
}
