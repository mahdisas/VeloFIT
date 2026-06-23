"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthedProfile } from "@/lib/dal";
import {
  getFinanceDocuments,
  getFinancePayments,
  getOrders,
  getSoldItems,
  type FinanceDocsParams,
  type FinancePaymentsParams,
  type OrdersParams,
  type SoldItemsParams,
} from "@/lib/reports/server";
import type { FinanceDocument } from "@/lib/reports/finance-documents";
import type { FinancePayment } from "@/lib/reports/finance-payments";
import type { Order } from "@/lib/reports/orders";
import type { SoldItem } from "@/lib/reports/sold-items";

/** Reports mutations. gym_id always comes from the authed profile (RLS-scoped). */

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * All rows of the Finance Documents report matching the current filters (no
 * pagination), for CSV/Excel export. Re-uses the same RPC; bounded by filters.
 */
export async function exportFinanceDocuments(params: FinanceDocsParams): Promise<FinanceDocument[]> {
  const { rows } = await getFinanceDocuments({ ...params, page: 1, pageSize: 100000 });
  return rows;
}

/** All Finance Payments rows matching the current filters (no pagination), for export. */
export async function exportFinancePayments(params: FinancePaymentsParams): Promise<FinancePayment[]> {
  const { rows } = await getFinancePayments({ ...params, page: 1, pageSize: 100000 });
  return rows;
}

/** All Orders rows matching the current filters (no pagination), for export. */
export async function exportOrders(params: OrdersParams): Promise<Order[]> {
  const { rows } = await getOrders({ ...params, page: 1, pageSize: 100000 });
  return rows;
}

/** All Sold-items rows matching the current filters (no pagination), for export. */
export async function exportSoldItems(params: SoldItemsParams): Promise<SoldItem[]> {
  const { rows } = await getSoldItems({ ...params, page: 1, pageSize: 100000 });
  return rows;
}

const shiftSchema = z.object({
  trainerId: z.string().uuid("Pick an employee"),
  start: z.string().min(1, "Start time is required"),
  end: z.string().min(1, "End time is required"),
});

export type NewStaffShiftInput = z.infer<typeof shiftSchema>;

/**
 * Record a staff work shift (clock-in/out) for the Employee Presence report.
 * Inserts a real `staff_shifts` row scoped to the authed gym.
 */
export async function createStaffShift(input: NewStaffShiftInput): Promise<ActionResult> {
  const { supabase, profile } = await getAuthedProfile();

  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  if (v.end <= v.start) return { ok: false, error: "End time must be after start time." };

  // The shift's rate is the trainer's default hourly_rate (the UI has no rate
  // input). `trainers` has no rate of its own — it comes from the linked staff
  // profile; 0 when the trainer has no login/profile. Both reads are RLS-scoped.
  const { data: trainer, error: trainerError } = await supabase
    .from("trainers")
    .select("profile_id")
    .eq("id", v.trainerId)
    .eq("gym_id", profile.gymId)
    .maybeSingle();
  if (trainerError) return { ok: false, error: trainerError.message };
  if (!trainer) return { ok: false, error: "Employee not found." };

  let hourlyRate = 0;
  if (trainer.profile_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("hourly_rate")
      .eq("id", trainer.profile_id)
      .maybeSingle();
    hourlyRate = Number(prof?.hourly_rate ?? 0);
  }

  const { data, error } = await supabase
    .from("staff_shifts")
    .insert({
      gym_id: profile.gymId, // ← tenant from the authed session, not the UI
      trainer_id: v.trainerId,
      started_at: v.start,
      ended_at: v.end,
      hourly_rate: hourlyRate,
      status: "completed",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/reports/employee-presence");
  return { ok: true, id: data.id as string };
}
