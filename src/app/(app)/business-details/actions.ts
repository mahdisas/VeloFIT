"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Business-details mutations. name/email/phone/address are columns on `gyms`;
 * whatsapp + social URLs + description live under settings->'business'. The logo
 * goes to Supabase Storage (public bucket) and its URL into gyms.logo_url.
 * Editing the gym is owner/admin-only (gyms RLS).
 */

export type BusinessDetailsInput = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  location: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  description: string;
  vatRate: number;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const schema = z.object({
  name: z.string().trim().min(1, "Business name is required"),
  email: z.string().trim().refine((v) => v === "" || EMAIL_RE.test(v), "Enter a valid email"),
  phone: z.string(),
  whatsapp: z.string(),
  location: z.string(),
  facebookUrl: z.string(),
  instagramUrl: z.string(),
  tiktokUrl: z.string(),
  description: z.string(),
  vatRate: z.number().min(0, "VAT rate can't be negative").max(100, "VAT rate can't exceed 100%"),
});

const clean = (s: string) => {
  const t = s.trim();
  return t === "" ? null : t;
};

export async function saveBusinessDetails(input: BusinessDetailsInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  if (profile.role !== "owner" && profile.role !== "admin") {
    return { ok: false, error: "Only owners or admins can edit business details." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  // Merge the 'business' sub-object into settings (preserve other keys, e.g. classes/family).
  const { data: gymRow } = await supabase.from("gyms").select("settings").eq("id", profile.gymId).single();
  const settings = ((gymRow?.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const business = {
    whatsapp: clean(v.whatsapp),
    facebookUrl: clean(v.facebookUrl),
    instagramUrl: clean(v.instagramUrl),
    tiktokUrl: clean(v.tiktokUrl),
    description: clean(v.description),
    vatRate: v.vatRate,
  };

  const { error } = await supabase
    .from("gyms")
    .update({
      name: v.name.trim(),
      email: clean(v.email),
      phone: clean(v.phone),
      address: clean(v.location),
      settings: { ...settings, business },
    })
    .eq("id", profile.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/business-details");
  revalidatePath("/", "layout"); // refresh the gym name shown in the sidebar/topbar
  return { ok: true };
}

const LOGO_BUCKET = "gym-assets";

/** Upload the gym logo to Storage and save its public URL to gyms.logo_url. */
export async function uploadGymLogo(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { supabase, profile } = await getAuthedProfile();
  if (profile.role !== "owner" && profile.role !== "admin") {
    return { ok: false, error: "Only owners or admins can change the logo." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file selected." };
  if (!["image/jpeg", "image/png"].includes(file.type)) return { ok: false, error: "Only JPEG or PNG images are allowed." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Image must be under 5MB." };

  const admin = createAdminClient();
  // Ensure the public bucket exists (idempotent — a duplicate error is fine).
  await admin.storage.createBucket(LOGO_BUCKET, { public: true });

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${profile.gymId}/logo-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage.from(LOGO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const url = admin.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;

  const { error: gymErr } = await supabase.from("gyms").update({ logo_url: url }).eq("id", profile.gymId);
  if (gymErr) return { ok: false, error: gymErr.message };

  revalidatePath("/business-details");
  revalidatePath("/", "layout"); // refresh the gym logo shown in the sidebar/topbar
  return { ok: true, url };
}
