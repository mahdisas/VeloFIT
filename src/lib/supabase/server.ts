import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { PERSIST_COOKIE, persistFromCookieValue, scopeCookie } from "./persistence";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Cookie-based session, so RLS sees the signed-in staff member's gym.
 *
 * Honors "Keep me signed in": refreshed auth cookies are scoped to a session
 * cookie unless the `velofit-persist` cookie opts in (see persistence.ts).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const persist = persistFromCookieValue(cookieStore.get(PERSIST_COOKIE)?.value);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, scopeCookie(options, persist))
            );
          } catch {
            // Called from a Server Component — the proxy refreshes sessions instead.
          }
        },
      },
    }
  );
}
