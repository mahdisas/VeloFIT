/**
 * Auth constants/helpers shared between the login form, the sign-out action and
 * the proxy. NOTE: the gym-code cookie is a tenant *hint* for UX (pre-fill,
 * display) — it is NOT a security boundary. Real tenant isolation is enforced
 * by Postgres RLS against the authenticated session's profile.gym_id.
 */

export const GYM_CODE_COOKIE = "velofit-gym-code";

/**
 * Domain used to synthesize a staff login email from their username + gym slug
 * (`<username>@<slug>.<STAFF_EMAIL_DOMAIN>`). It's an internal auth identifier,
 * never shown to users. Centralized so login + user-provisioning always agree.
 * NOTE: changing this requires migrating existing auth.users emails (see
 * supabase/migrations/00011_rebrand_auth_email_domain.sql) or logins break.
 */
export const STAFF_EMAIL_DOMAIN = "velofit";

/** Persist the active gym code as a client-readable cookie (30 days). */
export function rememberGymCode(code: string) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie =
    `${GYM_CODE_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax` +
    secure;
}

/** Read the remembered gym code, if any (used to pre-fill the login form). */
export function readGymCode(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${GYM_CODE_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}
