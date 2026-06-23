/**
 * Products types (Finance · Products). A product is a retail item sold at the
 * front desk / in the member app: one category, a price, an optional image, and
 * a "show in app" flag. Real, RLS-scoped reads/writes live in
 * lib/finance/products-server.ts and app/(app)/finance/products/actions.ts.
 */

export type Product = {
  id: string;
  name: string;
  /** FK → product_categories.id (null if the category was removed). */
  categoryId: string | null;
  /** Denormalised category label for the table — joined at read time. */
  categoryName: string;
  price: number;
  showInApp: boolean;
  description: string;
  imageUrl: string | null;
  isActive: boolean;
};

// getProducts() is a real, RLS-scoped query — see lib/finance/products-server.ts.
