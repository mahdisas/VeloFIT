/**
 * Business details types (the gym's public profile). Maps onto the public.gyms
 * row (name/email/phone/address/logo_url) plus gyms.settings->'business'
 * (whatsapp, social URLs, description). Real, RLS-scoped reads/writes live in
 * lib/business-server.ts and app/(app)/business-details/actions.ts.
 */

export type BusinessDetails = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  location: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  description: string;
  vatRate: number; // gym-wide VAT percent applied to tax invoices (default 18)
  logoUrl: string | null;
};

/** Minimal gym identity for the app shell (sidebar + topbar). */
export type GymIdentity = {
  name: string;
  slug: string;
  logoUrl: string | null;
  /** Nav hrefs the platform console hid for this gym (gyms.settings.hiddenPages). */
  hiddenPages: string[];
};

// getBusinessDetails() is a real, RLS-scoped query — see lib/business-server.ts.
