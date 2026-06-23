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
  // scope: "local" clears only THIS device's session — no server-side global
  // revoke, so a stale/expired refresh token can't make logout fail (the
  // /auth/v1/token 400 case). Wrapped so any unexpected error still falls
  // through to clearing cookies + redirecting — logout must never get stuck.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore — the cookie clearing + redirect below complete the logout
  }

  const cookieStore = await cookies();
  cookieStore.delete(GYM_CODE_COOKIE);
  cookieStore.delete(PERSIST_COOKIE);

  redirect("/login"); // must stay outside the try/catch (throws NEXT_REDIRECT)
}
