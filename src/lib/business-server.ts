import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type BusinessDetails, type GymIdentity } from "@/lib/business";

/** Name + slug + logo for the app shell (sidebar/topbar). */
export async function getGymIdentity(): Promise<GymIdentity> {
  const { supabase, profile } = await getAuthedProfile();
  const { data } = await supabase
    .from("gyms")
    .select("name, slug, logo_url")
    .eq("id", profile.gymId)
    .single();
  return {
    name: data?.name ?? "",
    slug: data?.slug ?? "",
    logoUrl: data?.logo_url ?? null,
  };
}

/**
 * The gym's public profile. name / email / phone / address / logo_url are
 * columns on `gyms`; whatsapp, the social URLs and the description live under
 * gyms.settings->'business'.
 */
type BusinessSettings = {
  whatsapp?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  description?: string;
  vatRate?: number;
};

export async function getBusinessDetails(): Promise<BusinessDetails> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("gyms")
    .select("name, email, phone, address, logo_url, settings")
    .eq("id", profile.gymId)
    .single();
  if (error) throw new Error(`Failed to load business details: ${error.message}`);

  const business = ((data?.settings as { business?: BusinessSettings } | null)?.business ?? {}) as BusinessSettings;

  return {
    name: data?.name ?? "",
    email: data?.email ?? "",
    phone: data?.phone ?? "",
    whatsapp: business.whatsapp ?? "",
    location: data?.address ?? "",
    facebookUrl: business.facebookUrl ?? "",
    instagramUrl: business.instagramUrl ?? "",
    tiktokUrl: business.tiktokUrl ?? "",
    description: business.description ?? "",
    vatRate: typeof business.vatRate === "number" ? business.vatRate : 18,
    logoUrl: data?.logo_url ?? null,
  };
}
