import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer — the single server-side auth gate.
 *
 * `getAuthedProfile()` verifies there's a signed-in staff member with a
 * provisioned profile, and returns that profile (incl. the tenant `gymId`)
 * alongside the cookie-scoped Supabase client. Use it at the top of every
 * protected Server Component / Server Action so data access is always
 * authenticated AND scoped to the caller's gym — RLS enforces the gym at the
 * database level too, but this keeps the intent explicit and gives us the
 * gym id for filters. Redirects to /login if unauthenticated or unprovisioned.
 *
 * Per the Next.js docs, the proxy (middleware) is a UX redirect layer, not the
 * security boundary — this DAL is where protected reads/writes are actually
 * gated.
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type AuthedProfile = {
  userId: string;
  gymId: string;
  role: string;
  fullName: string;
  permissions: Record<string, boolean>;
};

/**
 * Wrapped in React `cache()` so it runs at most ONCE per server request: the
 * first caller does the `auth.getUser()` + profiles round-trip, and every other
 * fetcher in the same render (including those run in parallel via Promise.all)
 * reuses the result instead of re-authenticating. Server Actions are separate
 * requests, so each still re-auths — security is unchanged.
 */
export const getAuthedProfile = cache(async function getAuthedProfile(): Promise<{
  supabase: ServerSupabase;
  profile: AuthedProfile;
}> {
  const supabase = await createClient();

  // A stale/invalid refresh token makes getUser() reject (400
  // refresh_token_not_found) — treat as unauthenticated and bounce to /login
  // rather than letting the throw 500 the page.
  let user = null;
  try {
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    user = null;
  }
  if (!user) redirect("/login");

  // One round-trip: the profile plus the gym's suspension flag (join, not a
  // second query — this runs on EVERY server request). Requires migration 00018
  // (gyms.is_active).
  const { data, error } = await supabase
    .from("profiles")
    .select("gym_id, role, full_name, permissions, gym:gyms(is_active)")
    .eq("id", user.id)
    .single();

  // Authenticated but no profile row → not linked to any gym; treat as logged out.
  if (error || !data) redirect("/login");

  // Suspended-gym gate: nobody in a suspended gym can use the app.
  const gym = data.gym as unknown as { is_active: boolean } | null;
  if (gym && gym.is_active === false) redirect("/login");

  return {
    supabase,
    profile: {
      userId: user.id,
      gymId: data.gym_id,
      role: data.role,
      fullName: data.full_name,
      permissions: (data.permissions ?? {}) as Record<string, boolean>,
    },
  };
});
