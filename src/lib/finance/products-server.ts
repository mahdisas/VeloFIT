import "server-only";

import { getAuthedProfile } from "@/lib/dal";
import { type Product } from "@/lib/finance/products";

type ProductRow = {
  id: string;
  name: string;
  category_id: string | null;
  price: number;
  show_in_app: boolean;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  category: { name: string } | null;
};

/** Retail products joined to their category name (Finance · Products). */
export async function getProducts(): Promise<Product[]> {
  const { supabase, profile } = await getAuthedProfile();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, category_id, price, show_in_app, description, image_url, is_active, category:product_categories(name)")
    .eq("gym_id", profile.gymId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load products: ${error.message}`);

  return ((data ?? []) as unknown as ProductRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    categoryId: p.category_id,
    categoryName: p.category?.name ?? "—",
    price: Number(p.price),
    showInApp: p.show_in_app,
    description: p.description ?? "",
    imageUrl: p.image_url,
    isActive: p.is_active,
  }));
}
