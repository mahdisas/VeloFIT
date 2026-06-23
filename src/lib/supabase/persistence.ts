/**
 * "Keep me signed in" support for the cookie-based Supabase session.
 *
 * @supabase/ssr always writes the auth cookies with a fixed 400-day maxAge
 * (DEFAULT_COOKIE_OPTIONS), so passing `cookieOptions.maxAge` has no effect.
 * To honor the user's choice we post-process every auth-cookie write instead:
 * when the user did NOT tick "Keep me signed in", we strip `maxAge`/`expires`
 * so the cookie becomes a SESSION cookie (cleared when the browser closes).
 *
 * The choice lives in a first-party `velofit-persist` cookie so all three cookie
 * writers agree on the lifetime: the browser client, the server client, and the
 * proxy (which refreshes the session on every request).
 */

/** Cookie that records the choice ("1" = keep signed in; anything else = no). */
export const PERSIST_COOKIE = "velofit-persist";

/** Lifetime of a "remembered" login (and of the preference cookie itself). */
export const PERSIST_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Whether the `velofit-persist` cookie value opts into a long-lived session. */
export function persistFromCookieValue(value: string | undefined): boolean {
  return value === "1";
}

/**
 * Scope cookie options to the chosen lifetime. When persisting, the library
 * default (400-day) is kept as-is; otherwise `maxAge`/`expires` are removed so
 * the browser treats it as a session cookie.
 */
export function scopeCookie<T extends { maxAge?: number; expires?: unknown }>(
  options: T,
  persist: boolean
): T {
  if (persist) return options;
  // Preserve cookie DELETIONS (maxAge <= 0) so sign-out / token rotation truly
  // clears the auth cookies. Only a positive lifetime is dropped, turning a
  // persistent auth cookie into a session cookie.
  if (typeof options.maxAge === "number" && options.maxAge <= 0) return options;
  const next = { ...options };
  delete next.maxAge;
  delete next.expires;
  return next;
}
