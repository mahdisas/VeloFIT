import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

import { PERSIST_COOKIE, PERSIST_MAX_AGE, persistFromCookieValue, scopeCookie } from "./persistence";

/** Read the current "Keep me signed in" choice from the first-party cookie. */
function isPersisting(): boolean {
  if (typeof document === "undefined") return false;
  const found = parseCookieHeader(document.cookie).find((c) => c.name === PERSIST_COOKIE);
  return persistFromCookieValue(found?.value);
}

/**
 * Supabase client for Client Components (browser).
 *
 * Honors "Keep me signed in": its cookie adapter strips maxAge/expires from the
 * auth cookies when the choice is OFF, so they become session cookies that clear
 * on browser close. The choice is read per-write from the `velofit-persist` cookie,
 * so the (singleton) client always reflects the latest preference. See
 * lib/supabase/persistence.ts for why cookieOptions.maxAge can't be used.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === "undefined") return [];
          return parseCookieHeader(document.cookie).map((c) => ({ name: c.name, value: c.value ?? "" }));
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          const persist = isPersisting();
          for (const { name, value, options } of cookiesToSet) {
            document.cookie = serializeCookieHeader(name, value, scopeCookie(options, persist));
          }
        },
      },
    }
  );
}

/**
 * Persist the "Keep me signed in" choice as a first-party cookie, read by the
 * browser client, the server client, and the proxy. Call it BEFORE signing in so
 * the resulting auth cookies are written with the right lifetime.
 */
export function setSessionPersistence(persist: boolean) {
  if (typeof document === "undefined") return;
  document.cookie = serializeCookieHeader(
    PERSIST_COOKIE,
    persist ? "1" : "0",
    persist
      ? { path: "/", maxAge: PERSIST_MAX_AGE, sameSite: "lax" }
      : { path: "/", sameSite: "lax" } // session cookie — gone on browser close
  );
}
