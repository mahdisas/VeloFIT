"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { ProductDialog } from "@/components/finance/product-dialog";
import { deleteProduct } from "@/app/(app)/finance/products/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePager } from "@/components/ui/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Product } from "@/lib/finance/products";
import { type IdName } from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "name" | "categoryName" | "price" | "showInApp" | "description";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "categoryName", label: "Category" },
  { key: "price", label: "Price" },
  { key: "showInApp", label: "Show In App" },
  { key: "description", label: "Description" },
];

export function ProductsTable({
  products: initial,
  categoryOptions,
}: {
  products: Product[];
  categoryOptions: IdName[];
}) {
  const t = useT();
  const [products, setProducts] = React.useState(initial);
  const [active, setActive] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.isActive === active &&
        (!q || p.name.toLowerCase().includes(q) || p.categoryName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    );
  }, [products, active, query]);

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const onSaved = (product: Product) => {
    const exists = products.some((p) => p.id === product.id);
    setProducts((prev) =>
      prev.some((p) => p.id === product.id) ? prev.map((p) => (p.id === product.id ? product : p)) : [product, ...prev]
    );
    toast.success(exists ? t("Product updated") : t("Product added"));
  };

  const onDelete = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    void deleteProduct(id);
    toast.success(t("Product deleted"));
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("Search in products")} className="ps-9" />
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            <SegBtn active={active} onClick={() => { setActive(true); setPage(1); }}>{t("Active Products")}</SegBtn>
            <SegBtn active={!active} onClick={() => { setActive(false); setPage(1); }}>{t("Inactive Products")}</SegBtn>
          </div>
          <ProductDialog categoryOptions={categoryOptions} onSaved={onSaved}>
            <Button><Plus className="size-4" /> {t("New Product")}</Button>
          </ProductDialog>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((col) => (
                  <TableHead key={col.key}>
                    <button type="button" onClick={() => toggleSort(col.key)} className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground">
                      {t(col.label)}
                      <ChevronsUpDown className={cn("size-3.5", sort.key === col.key ? "text-foreground" : "text-muted-foreground/50")} />
                    </button>
                  </TableHead>
                ))}
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 1} className="h-24 text-center text-muted-foreground">
                    {t("No data available in the table")}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><span dir="auto" className="font-medium">{p.name}</span></TableCell>
                    <TableCell className="text-muted-foreground"><span dir="auto">{p.categoryName || "—"}</span></TableCell>
                    <TableCell>{p.price}</TableCell>
                    <TableCell><BoolMark value={p.showInApp} /></TableCell>
                    <TableCell className="max-w-xs text-muted-foreground"><span dir="auto" className="line-clamp-1">{p.description || "—"}</span></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <ProductDialog product={p} categoryOptions={categoryOptions} onSaved={onSaved}>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" aria-label={t("Edit product")}>
                            <Pencil className="size-4" />
                          </Button>
                        </ProductDialog>
                        <DeleteProduct name={p.name} onConfirm={() => onDelete(p.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <TablePager
          page={safePage}
          pageSize={pageSize}
          totalRows={sorted.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </CardContent>
    </Card>
  );
}

function BoolMark({ value }: { value: boolean }) {
  return value ? (
    <Check className="size-4 text-emerald-600" />
  ) : (
    <X className="size-4 text-muted-foreground" />
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-md px-3 py-1.5 transition-colors", active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {children}
    </button>
  );
}

function DeleteProduct({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Delete product")}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Delete product?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("This will permanently remove")} <span dir="auto" className="font-medium text-foreground">{name}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction className={cn(buttonVariants({ variant: "destructive" }))} onClick={(e) => { e.preventDefault(); onConfirm(); }}>
            {t("Delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
