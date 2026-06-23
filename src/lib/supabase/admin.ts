import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS, so it is server-only and must be
 * used sparingly — only where the cookie-scoped client can't do the job (e.g.
 * provisioning staff auth accounts via the Auth Admin API). Callers MUST do
 * their own tenant + role authorization first (getAuthedProfile).
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
