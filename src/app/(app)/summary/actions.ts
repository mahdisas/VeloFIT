"use server";

import { type SummaryData, type SummaryParams } from "@/lib/summary";
import { getSummary } from "@/lib/summary-server";

/**
 * Server action the Summary builder calls whenever the period/language changes.
 * Runs on the server, so when getSummary() is wired to Supabase it will use the
 * cookie-scoped server client (RLS sees the signed-in gym) with no extra work.
 */
export async function fetchSummary(params: SummaryParams): Promise<SummaryData> {
  return getSummary(params);
}
