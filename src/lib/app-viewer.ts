import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { getMemberSession } from "@/lib/member-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { type createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Who is using the veloFIT app right now. Both kinds carry a `supabase` handle +
 * `gymId` so the data layer can stay viewer-agnostic:
 *   - staff   → the cookie-scoped client (RLS keeps reads inside their gym).
 *   - member  → the service-role client (RLS can't scope an unauthenticated
 *               member, so EVERY member query must filter by `gymId` itself, and
 *               by `clientId` for that member's private data).
 *
 * The member path is the TEMPORARY phone+code login (see member-session); it
 * checks first because staff never carry a member cookie.
 */
export type AppViewer =
  | { kind: "staff"; supabase: ServerSupabase; gymId: string; userId: string; name: string }
  | { kind: "member"; supabase: ServerSupabase; gymId: string; clientId: string; name: string };

export async function getAppViewer(): Promise<AppViewer> {
  const member = await getMemberSession();
  if (member) {
    return {
      kind: "member",
      // Same query API as the cookie client; typed alike so fetchers are shared.
      supabase: createAdminClient() as unknown as ServerSupabase,
      gymId: member.gymId,
      clientId: member.clientId,
      name: member.name,
    };
  }
  const { supabase, profile } = await getAuthedProfile();
  return { kind: "staff", supabase, gymId: profile.gymId, userId: profile.userId, name: profile.fullName };
}
