import type { Metadata } from "next";
import Link from "next/link";

import { ProductsTable } from "@/components/finance/products-table";
import { getCategoryOptions } from "@/lib/finance/categories-server";
import { getProducts } from "@/lib/finance/products-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const [products, categoryOptions] = await Promise.all([getProducts(), getCategoryOptions()]);
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Products")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Products")}</h1>

      <ProductsTable products={products} categoryOptions={categoryOptions} />
    </div>
  );
}
