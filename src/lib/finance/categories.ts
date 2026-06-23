/**
 * Product Categories types (Finance · Categories). A category groups retail
 * products (supplements, apparel, …) for the shop; each product references one
 * category. Real, RLS-scoped reads/writes live in lib/finance/categories-server.ts
 * and app/(app)/finance/categories/actions.ts.
 */

export type Category = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
};

// getCategories() and getCategoryOptions() are real, RLS-scoped queries — see
// lib/finance/categories-server.ts.
