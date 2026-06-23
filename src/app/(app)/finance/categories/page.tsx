import type { Metadata } from "next";
import Link from "next/link";

import { CategoriesTable } from "@/components/finance/categories-table";
import { getCategories } from "@/lib/finance/categories-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await getCategories();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Categories")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Categories")}</h1>

      <CategoriesTable categories={categories} />
    </div>
  );
}
