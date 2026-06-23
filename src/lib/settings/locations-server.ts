import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type Location } from "@/lib/settings/locations";

/** Real locations for the signed-in gym (Settings · Locations). */
export async function getLocations(): Promise<Location[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("locations")
    .select("id, name, description")
    .eq("gym_id", profile.gymId)
    .order("created_at");

  if (error) throw new Error(`Failed to load locations: ${error.message}`);

  return ((data ?? []) as { id: string; name: string; description: string | null }[]).map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description ?? "",
  }));
}
