"use client";

import * as React from "react";
import { ArrowDownUp, ShoppingBag } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Product } from "@/lib/finance/products";
import { useT } from "@/lib/i18n/provider";

/** Shop · Products — the in-app store with client-side category filter + price sort. */
export function MobileProducts({ products }: { products: Product[] }) {
  const t = useT();
  const [category, setCategory] = React.useState("all");
  const [sort, setSort] = React.useState<"default" | "asc" | "desc">("default");

  // Distinct categories present in the catalogue.
  const categories = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) if (p.categoryId) map.set(p.categoryId, p.categoryName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [products]);

  const shown = React.useMemo(() => {
    let list = category === "all" ? products : products.filter((p) => p.categoryId === category);
    if (sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, category, sort]);

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center text-muted-foreground">
        <ShoppingBag className="size-8" />
        <p className="text-sm">{t("No products available")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Filter + sort row */}
      <div className="flex gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-10 flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All categories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}><span dir="auto">{c.name}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-10 flex-1">
            <ArrowDownUp className="size-4 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t("Recommended")}</SelectItem>
            <SelectItem value="asc">{t("Price: Low to High")}</SelectItem>
            <SelectItem value="desc">{t("Price: High to Low")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("No products available")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((p) => (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="aspect-square w-full bg-muted">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-content-center text-muted-foreground/40">
                    <ShoppingBag className="size-8" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-0.5 p-3">
                <p className="truncate text-sm font-medium" dir="auto">{p.name}</p>
                <p className="text-xs text-muted-foreground" dir="auto">{p.categoryName}</p>
                <p className="mt-1 font-bold tabular-nums">₪{p.price}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
