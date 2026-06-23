/**
 * Leads-per-campaign report types + filter options. Real, RLS-scoped data is
 * fetched in lib/reports/server.ts (leads joined to campaigns).
 */

export const PLATFORM_OPTIONS = ["Instagram", "Facebook", "TikTok", "Web", "General", "other"];
export const CAMPAIGN_TYPE_OPTIONS = ["Paid Ad", "Organic Growth", "Promotion", "Brand Awareness", "Engagement", "Lead Generation", "Product Launch", "Event", "other"];

export type LeadRow = {
  id: string;
  date: string; // yyyy-mm-dd
  clientId: string;
  fullName: string;
  phone: string;
  campaign: string;
  platform: string;
  campaignType: string;
  gender: string;
};
