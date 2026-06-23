import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type Gender } from "@/lib/clients";
import { type LeadListRow, type LeadStatus } from "@/lib/leads";

/** Active (non-converted) leads for the signed-in gym, newest first. */
export async function getLeads(): Promise<LeadListRow[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, national_id, birth_date, phone, gender, avatar_url, blocked, status")
    .eq("gym_id", profile.gymId)
    .neq("status", "converted")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load leads: ${error.message}`);

  return ((data ?? []) as LeadRow[]).map((l) => ({
    id: l.id,
    fullName: l.full_name,
    nationalId: l.national_id ?? "",
    birthDate: l.birth_date,
    phone: l.phone ?? "",
    gender: (l.gender as Gender) ?? "other",
    avatarUrl: l.avatar_url,
    blocked: l.blocked,
    status: l.status as LeadStatus,
  }));
}

type LeadRow = {
  id: string;
  full_name: string;
  national_id: string | null;
  birth_date: string | null;
  phone: string | null;
  gender: string | null;
  avatar_url: string | null;
  blocked: boolean;
  status: string;
};
