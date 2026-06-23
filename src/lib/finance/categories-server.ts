import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type Category } from "@/lib/finance/categories";

/** Product categories for the gym (Finance · Categories). */
export async function getCategories(): Promise<Category[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, description, is_active")
    .eq("gym_id", profile.gymId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load categories: ${error.message}`);

  return ((data ?? []) as { id: string; name: string; description: string | null; is_active: boolean }[]).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    isActive: c.is_active,
  }));
}

/** Active category options (id + name) for the Product drawer's category select. */
export async function getCategoryOptions(): Promise<{ id: string; name: string }[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("gym_id", profile.gymId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return (data ?? []) as { id: string; name: string }[];
}
