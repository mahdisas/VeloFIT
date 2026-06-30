import "server-only";

import { cookies } from "next/headers";

import {
  MEMBER_COOKIE,
  signMemberPayload,
  verifyMemberToken,
  type MemberSession,
} from "@/lib/member-token";

/**
 * TEMPORARY member (gym client) session — a stopgap until WhatsApp OTP login is
 * wired up. A member "logs in" with phone + gym code (no secret), so this is
 * deliberately low-assurance; the cookie is HMAC-signed (see member-token) so it
 * can't be forged client-side. Replace with real OTP auth before production.
 */
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type { MemberSession };
export { verifyMemberToken, MEMBER_COOKIE };

export async function setMemberSession(session: MemberSession): Promise<void> {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const token = `${payload}.${signMemberPayload(payload)}`;
  const store = await cookies();
  store.set(MEMBER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** The signed-in member, or null if there's no valid (untampered) cookie. */
export async function getMemberSession(): Promise<MemberSession | null> {
  const store = await cookies();
  return verifyMemberToken(store.get(MEMBER_COOKIE)?.value);
}

export async function clearMemberSession(): Promise<void> {
  const store = await cookies();
  store.delete(MEMBER_COOKIE);
}
