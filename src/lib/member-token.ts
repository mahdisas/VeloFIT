import crypto from "node:crypto";

/**
 * Pure member-token sign/verify — no `next/headers`, so it's safe to import from
 * the proxy (middleware) as well as Server Components. The cookie payload is
 * HMAC-signed with a server-only key so it can't be forged client-side.
 */
export const MEMBER_COOKIE = "velofit_member";

export type MemberSession = { clientId: string; gymId: string; name: string };

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "velofit-dev-member-secret";
}

export function signMemberPayload(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Verify a raw cookie value → its session, or null if missing/tampered. */
export function verifyMemberToken(token: string | undefined | null): MemberSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = signMemberPayload(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as MemberSession;
  } catch {
    return null;
  }
}
