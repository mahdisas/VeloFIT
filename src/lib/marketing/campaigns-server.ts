import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type Campaign } from "@/lib/marketing/campaigns";

/** Marketing campaigns for the gym, newest first. */
export async function getCampaigns(): Promise<Campaign[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, platform_type, campaign_type, url, description, is_active")
    .eq("gym_id", profile.gymId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load campaigns: ${error.message}`);

  return ((data ?? []) as CampaignRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    platformType: c.platform_type,
    campaignType: c.campaign_type,
    url: c.url ?? "",
    description: c.description ?? "",
    isActive: c.is_active,
  }));
}

type CampaignRow = {
  id: string;
  name: string;
  platform_type: string;
  campaign_type: string;
  url: string | null;
  description: string | null;
  is_active: boolean;
};
