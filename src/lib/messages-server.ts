import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type GroupOption, type MessageTemplate } from "@/lib/messages";

/** Group filter options for the broadcast composer (the gym's class groups). */
export async function getGroups(): Promise<GroupOption[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("class_groups")
    .select("id, name")
    .eq("gym_id", profile.gymId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Failed to load groups: ${error.message}`);

  return [
    { value: "all", label: "All" },
    ...((data ?? []) as { id: string; name: string }[]).map((g) => ({ value: g.id, label: g.name })),
  ];
}

/** Saved SMS templates for the gym, newest first. */
export async function getTemplates(): Promise<MessageTemplate[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("message_templates")
    .select("id, title, content")
    .eq("gym_id", profile.gymId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load templates: ${error.message}`);
  return (data ?? []) as MessageTemplate[];
}
