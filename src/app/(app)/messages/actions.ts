"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";
import { NAME_PLACEHOLDER, smsInfo } from "@/lib/messages";

/** Messages Center mutations. gym_id from the authed profile; RLS-scoped. */

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const templateSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  content: z.string(),
});

export async function createTemplate(input: { title: string; content: string }): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("message_templates")
    .insert({ gym_id: profile.gymId, title: parsed.data.title.trim(), content: parsed.data.content })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/messages");
  return { ok: true, id: data.id as string };
}

export async function updateTemplate(id: string, input: { title: string; content: string }): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("message_templates")
    .update({ title: parsed.data.title.trim(), content: parsed.data.content })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/messages");
  return { ok: true, id };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const { error } = await supabase.from("message_templates").delete().eq("id", id).eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/messages");
  return { ok: true, id };
}

export type BroadcastInput = {
  group: string; // class_group id or "all"
  subscriptionType: string; // all | active | inactive
  message: string;
};

export type BroadcastResult = { ok: true; recipients: number } | { ok: false; error: string };

type SubRow = {
  status: string;
  end_date: string;
  client: { id: string; full_name: string; messaging_opt: boolean } | null;
  plan: { group_id: string | null } | null;
};

/**
 * Resolve recipients from the gym's subscriptions (filtered by group + status,
 * messaging opt-in only), personalize {{1}} → client name, and enqueue one
 * `messages` row per distinct client. Provider delivery is out of scope — rows
 * land in status 'queued'.
 */
export async function sendBroadcast(input: BroadcastInput): Promise<BroadcastResult> {
  const { supabase, profile } = await getAuthedProfile();

  const message = input.message.trim();
  if (!message) return { ok: false, error: "Message is empty" };

  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, end_date, client:clients(id, full_name, messaging_opt), plan:subscription_plans(group_id)")
    .eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  const today = new Date().toISOString().slice(0, 10);
  const recipients = new Map<string, string>(); // clientId → full_name (deduped)

  for (const s of (data ?? []) as unknown as SubRow[]) {
    if (!s.client || s.client.messaging_opt === false) continue;
    if (input.group !== "all" && s.plan?.group_id !== input.group) continue;
    const isActive = s.status === "active" && s.end_date >= today;
    if (input.subscriptionType === "active" && !isActive) continue;
    if (input.subscriptionType === "inactive" && isActive) continue;
    recipients.set(s.client.id, s.client.full_name);
  }

  if (recipients.size === 0) return { ok: false, error: "No recipients match this filter." };

  const segments = smsInfo(message).messages;
  const rows = [...recipients.entries()].map(([clientId, name]) => ({
    gym_id: profile.gymId,
    client_id: clientId,
    channel: "sms",
    content: message.split(NAME_PLACEHOLDER).join(name),
    segments,
    status: "queued",
    sent_by: profile.userId,
  }));

  const { error: insertError } = await supabase.from("messages").insert(rows);
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/messages");
  return { ok: true, recipients: recipients.size };
}
