"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";

/**
 * Leads mutations. gym_id always from the authed profile; RLS scopes the writes.
 * Converting a lead inserts a clients row and marks the lead 'converted' with a
 * back-reference (converted_client_id).
 */

export type NewLeadInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate?: string;
  countryCode: string;
  phone: string;
  nationalId?: string;
  phone2?: string;
  email?: string;
  gender: "male" | "female";
  messagingService: boolean;
  blocked: boolean;
  city?: string;
  address?: string;
  notes?: string;
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const nullable = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().trim().min(1, "Last name is required"),
  birthDate: z.string().optional(),
  countryCode: z.string(),
  phone: z.string().trim().min(1, "Phone number is required"),
  nationalId: z.string().optional(),
  phone2: z.string().optional(),
  email: z.string().optional(),
  gender: z.enum(["male", "female"]),
  messagingService: z.boolean(),
  blocked: z.boolean(),
  city: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export async function createLead(input: NewLeadInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const fullName = [v.firstName, v.middleName, v.lastName].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");

  const { data, error } = await supabase
    .from("leads")
    .insert({
      gym_id: profile.gymId,
      full_name: fullName,
      national_id: nullable(v.nationalId),
      birth_date: nullable(v.birthDate),
      phone: `${v.countryCode} ${v.phone}`.trim(),
      phone2: nullable(v.phone2),
      email: nullable(v.email),
      gender: v.gender,
      city: nullable(v.city),
      address: nullable(v.address),
      notes: nullable(v.notes),
      messaging_opt: v.messagingService,
      blocked: v.blocked,
      status: "new",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/leads");
  return { ok: true, id: data.id as string };
}

export async function deleteLead(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();
  const { error } = await supabase.from("leads").delete().eq("id", id).eq("gym_id", profile.gymId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/leads");
  return { ok: true, id };
}

/** Promote a lead to a client: create the client, then mark the lead converted. */
export async function convertLead(id: string): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const { data: lead, error: readError } = await supabase
    .from("leads")
    .select("full_name, national_id, birth_date, phone, phone2, email, gender, city, address, notes, messaging_opt, converted_client_id")
    .eq("id", id)
    .eq("gym_id", profile.gymId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!lead) return { ok: false, error: "Lead not found." };
  if (lead.converted_client_id) return { ok: false, error: "This lead is already converted." };

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      gym_id: profile.gymId,
      full_name: lead.full_name,
      national_id: lead.national_id,
      birth_date: lead.birth_date,
      phone: lead.phone,
      phone2: lead.phone2,
      email: lead.email,
      gender: lead.gender,
      city: lead.city,
      address: lead.address,
      notes: lead.notes,
      messaging_opt: lead.messaging_opt,
      status: "active",
    })
    .select("id")
    .single();
  if (clientError) return { ok: false, error: clientError.message };

  const { error: updateError } = await supabase
    .from("leads")
    .update({ status: "converted", converted_client_id: client.id })
    .eq("id", id)
    .eq("gym_id", profile.gymId);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/leads");
  revalidatePath("/clients");
  return { ok: true, id: client.id as string };
}
