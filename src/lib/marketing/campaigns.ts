/**
 * Marketing Campaigns types. A campaign is a tracked acquisition source (an
 * Instagram paid ad, a web landing page, …) that leads can be attributed to, so
 * the Leads report can measure channel performance. Real, RLS-scoped reads/writes
 * live in lib/marketing/campaigns-server.ts and app/(app)/marketing/campaigns/actions.ts.
 */

export const PLATFORM_TYPES = ["Instagram", "Facebook", "TikTok", "Web", "General", "other"] as const;

export const CAMPAIGN_TYPES = [
  "Paid Ad",
  "Organic Growth",
  "Promotion",
  "Brand Awareness",
  "Engagement",
  "Lead Generation",
  "Product Launch",
  "Event",
  "other",
] as const;

export type Campaign = {
  id: string;
  name: string;
  platformType: string;
  campaignType: string;
  url: string;
  description: string;
  isActive: boolean;
};

// getCampaigns() is a real, RLS-scoped query — see lib/marketing/campaigns-server.ts.
