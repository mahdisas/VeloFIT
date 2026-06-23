"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";
import { type TaskStatus } from "@/lib/tasks";

/** Tasks mutations. gym_id from the authed profile; RLS scopes the writes. */

export type TaskInput = {
  id?: string;
  clientId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  reminderDate?: string | null;
  blockingEntry: boolean;
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const STATUSES = ["new", "in_progress", "canceled", "finished"] as const;

const schema = z.object({
  id: z.string().optional(),
  clientId: z.string().optional(),
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(STATUSES),
  reminderDate: z.string().nullable().optional(),
  blockingEntry: z.boolean(),
});

export async function saveTask(input: TaskInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const row = {
    title: v.title.trim(),
    description: v.description?.trim() ? v.description.trim() : null,
    status: v.status,
    reminder_at: v.reminderDate || null,
    blocking_entry: v.blockingEntry,
  };

  if (v.id) {
    const { error } = await supabase.from("tasks").update(row).eq("id", v.id).eq("gym_id", profile.gymId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/tasks");
    return { ok: true, id: v.id };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({ gym_id: profile.gymId, client_id: v.clientId || null, ...row })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks");
  return { ok: true, id: data.id as string };
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id).eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true, id };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase.from("tasks").delete().eq("id", id).eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true, id };
}
