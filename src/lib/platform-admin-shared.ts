/**
 * Pure platform-admin allowlist helpers — NO imports, so they're safe to use from
 * the proxy (Node runtime) as well as server components/actions. A super-admin is
 * any user whose email is listed in the PLATFORM_ADMIN_EMAILS env var (comma-
 * separated). The DB-backed gate lives in lib/platform-admin.ts.
 */

/** Parsed, lowercased allowlist from PLATFORM_ADMIN_EMAILS. */
function allowlist(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Is this email a platform super-admin? */
export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowlist().has(email.trim().toLowerCase());
}

/** Whether any platform admin is configured (to show/hide the console entry). */
export function hasPlatformAdmins(): boolean {
  return allowlist().size > 0;
}
