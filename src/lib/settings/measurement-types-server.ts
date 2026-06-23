import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type MeasurementType } from "@/lib/settings/measurement-types";

/** Real measurement types for the gym, ordered by the manual sort sequence. */
export async function getMeasurementTypes(): Promise<MeasurementType[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("measurement_types")
    .select("id, name, unit, notes, sort_order, is_active")
    .eq("gym_id", profile.gymId)
    .order("sort_order");

  if (error) throw new Error(`Failed to load measurement types: ${error.message}`);

  return ((data ?? []) as MtRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    unit: t.unit ?? "",
    notes: t.notes ?? "",
    order: t.sort_order,
    isActive: t.is_active,
  }));
}

type MtRow = {
  id: string;
  name: string;
  unit: string | null;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
};
