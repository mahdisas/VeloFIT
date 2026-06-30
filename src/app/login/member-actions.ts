"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { clearMemberSession, setMemberSession } from "@/lib/member-session";

export type MemberCandidate = { id: string; name: string };
export type MemberLoginResult =
  | { status: "ok"; name: string }
  | { status: "error"; error: string }
  | { status: "select"; candidates: MemberCandidate[] };

type Admin = ReturnType<typeof createAdminClient>;

/** Escape Postgres LIKE/ILIKE wildcards so a gym code can't act as a pattern. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * National significant number: digits only, with the country dial code and any
 * leading trunk "0" stripped — so "0500000000", "500000000", "+972 50-000-0000",
 * and the dashboard's stored "+972 123" all compare equal. `dialCode` is the
 * selected country's digits, e.g. "972". Clients are saved as "<countryCode>
 * <number>" (see clients createClient), so the dial code is stripped whenever a
 * value starts with it — including short test numbers like "972123".
 */
function nsn(raw: string | null | undefined, dialCode: string): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (dialCode && d.length > dialCode.length && d.startsWith(dialCode)) d = d.slice(dialCode.length);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/** Resolve a gym by its code (slug), case-insensitive. */
async function resolveGym(admin: Admin, gymCode: string): Promise<{ id: string } | { error: string }> {
  const { data: gym, error } = await admin
    .from("gyms")
    .select("id")
    .ilike("slug", escapeLike(gymCode))
    .maybeSingle();
  if (error) return { error: "Couldn't reach the server. Please try again." };
  if (!gym) return { error: "Invalid Gym Code" };
  return { id: gym.id };
}

/**
 * TEMPORARY phone + gym-code login for the veloFIT app (no OTP — stopgap until
 * the WhatsApp API is live). Validates the gym code, then matches clients by phone
 * within that gym. Runs with the service-role client because the caller is not
 * authenticated yet (so RLS can't scope the lookup).
 *
 * If several clients share the number (common in a test gym), it returns the list
 * so the caller can pick which one to enter as — see loginAsClient.
 *
 * SECURITY: phone + gym code is low-assurance (no secret) — anyone who knows a
 * member's phone and the gym's code can sign in as them. Re-enable OTP before
 * production.
 */
export async function loginWithPhone(input: {
  phone: string;
  dialCode: string;
  gymCode: string;
}): Promise<MemberLoginResult> {
  const phone = (input.phone ?? "").trim();
  const dialCode = (input.dialCode ?? "").replace(/\D/g, "");
  const gymCode = (input.gymCode ?? "").trim();
  if (!phone || !gymCode) return { status: "error", error: "Please fill in all fields." };

  const admin = createAdminClient();
  const gym = await resolveGym(admin, gymCode);
  if ("error" in gym) return { status: "error", error: gym.error };

  const target = nsn(phone, dialCode);
  if (!target) return { status: "error", error: "No member found with this phone number." };

  const { data: clients, error: clientError } = await admin
    .from("clients")
    .select("id, full_name, phone, phone2")
    .eq("gym_id", gym.id)
    .neq("status", "archived");
  if (clientError) return { status: "error", error: "Couldn't reach the server. Please try again." };

  const matches = (clients ?? []).filter(
    (c) => nsn(c.phone, dialCode) === target || nsn(c.phone2, dialCode) === target
  );
  if (matches.length === 0) return { status: "error", error: "No member found with this phone number." };

  if (matches.length === 1) {
    const m = matches[0];
    await setMemberSession({ clientId: m.id, gymId: gym.id, name: m.full_name });
    return { status: "ok", name: m.full_name };
  }

  // Several clients share this number — let the caller choose which one to enter as.
  return { status: "select", candidates: matches.map((m) => ({ id: m.id, name: m.full_name })) };
}

/**
 * Finish a phone login when several clients share the number: enter as the chosen
 * client, but only after re-checking it belongs to the gym AND its phone matches —
 * so the caller can't pass an arbitrary client id.
 */
export async function loginAsClient(input: {
  clientId: string;
  phone: string;
  dialCode: string;
  gymCode: string;
}): Promise<MemberLoginResult> {
  const clientId = (input.clientId ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const dialCode = (input.dialCode ?? "").replace(/\D/g, "");
  const gymCode = (input.gymCode ?? "").trim();
  if (!clientId || !phone || !gymCode) return { status: "error", error: "Please fill in all fields." };

  const admin = createAdminClient();
  const gym = await resolveGym(admin, gymCode);
  if ("error" in gym) return { status: "error", error: gym.error };

  const { data: client, error } = await admin
    .from("clients")
    .select("id, full_name, phone, phone2")
    .eq("id", clientId)
    .eq("gym_id", gym.id)
    .neq("status", "archived")
    .maybeSingle();
  if (error) return { status: "error", error: "Couldn't reach the server. Please try again." };

  const target = nsn(phone, dialCode);
  const matches = client && (nsn(client.phone, dialCode) === target || nsn(client.phone2, dialCode) === target);
  if (!client || !target || !matches) return { status: "error", error: "No member found with this phone number." };

  await setMemberSession({ clientId: client.id, gymId: gym.id, name: client.full_name });
  return { status: "ok", name: client.full_name };
}

/** Sign a member out — clears the member cookie and returns to /login. */
export async function memberSignOut(): Promise<void> {
  await clearMemberSession();
  redirect("/login");
}
