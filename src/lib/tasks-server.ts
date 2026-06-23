import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type TaskRow, type TaskStatus } from "@/lib/tasks";

/** All tasks for the signed-in gym, joined to the client name, newest first. */
export async function getTasks(): Promise<TaskRow[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("tasks")
    .select("id, client_id, title, description, status, task_date, reminder_at, blocking_entry, client:clients(full_name)")
    .eq("gym_id", profile.gymId)
    .order("task_date", { ascending: false });

  if (error) throw new Error(`Failed to load tasks: ${error.message}`);

  return ((data ?? []) as unknown as TaskDbRow[]).map((t) => ({
    id: t.id,
    clientId: t.client_id ?? "",
    clientName: t.client?.full_name ?? "—",
    date: t.task_date,
    title: t.title,
    description: t.description ?? "",
    status: t.status as TaskStatus,
    reminderDate: t.reminder_at ? t.reminder_at.slice(0, 10) : null,
    blockingEntry: t.blocking_entry,
  }));
}

type TaskDbRow = {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: string;
  task_date: string;
  reminder_at: string | null;
  blocking_entry: boolean;
  client: { full_name: string } | null;
};
