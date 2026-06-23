"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { PackageDialog } from "@/components/finance/package-dialog";
import { deletePackage } from "@/app/(app)/finance/subscription-packages/actions";
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
import { type IdName } from "@/lib/classes";
import { type SubscriptionPackage } from "@/lib/finance/packages";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "name" | "groupName" | "price" | "periodMonths" | "isTrialLesson" | "showInApp";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "groupName", label: "Subscription Groups" },
  { key: "price", label: "Price" },
  { key: "periodMonths", label: "Period In Month" },
  { key: "isTrialLesson", label: "Is Trial Lesson" },
  { key: "showInApp", label: "Show In App" },
];

export function PackagesTable({
  packages: initial,
  groupOptions,
}: {
  packages: SubscriptionPackage[];
  groupOptions: IdName[];
}) {
  const t = useT();
  const [packages, setPackages] = React.useState(initial);
  const [active, setActive] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return packages.filter(
      (p) =>
        p.isActive === active &&
        (!q || p.name.toLowerCase().includes(q) || p.groupName.toLowerCase().includes(q))
    );
  }, [packages, active, query]);

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      if (typeof av === "boolean" && typeof bv === "boolean") return (Number(av) - Number(bv)) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const onSaved = (pkg: SubscriptionPackage) => {
    const exists = packages.some((p) => p.id === pkg.id);
    setPackages((prev) =>
      prev.some((p) => p.id === pkg.id) ? prev.map((p) => (p.id === pkg.id ? pkg : p)) : [pkg, ...prev]
    );
    toast.success(exists ? t("Package updated") : t("Package added"));
  };

  const onDelete = (id: string) => {
    setPackages((prev) => prev.filter((p) => p.id !== id));
    void deletePackage(id);
    toast.success(t("Package deleted"));
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("Search in packages")} className="ps-9" />
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            <SegBtn active={active} onClick={() => { setActive(true); setPage(1); }}>{t("Active Packages")}</SegBtn>
            <SegBtn active={!active} onClick={() => { setActive(false); setPage(1); }}>{t("Inactive Packages")}</SegBtn>
          </div>
          <PackageDialog groupOptions={groupOptions} onSaved={onSaved}>
            <Button><Plus className="size-4" /> {t("New Package")}</Button>
          </PackageDialog>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20">{t("Color")}</TableHead>
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
                  <TableCell colSpan={COLUMNS.length + 2} className="h-24 text-center text-muted-foreground">
                    {t("No data available in the table")}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="block size-6 rounded-md ring-1 ring-black/10" style={{ backgroundColor: p.color }} />
                    </TableCell>
                    <TableCell><span dir="auto" className="font-medium text-primary">{p.name}</span></TableCell>
                    <TableCell className="text-muted-foreground"><span dir="auto">{p.groupName || "—"}</span></TableCell>
                    <TableCell>{p.price}</TableCell>
                    <TableCell>{p.periodMonths}</TableCell>
                    <TableCell><BoolMark value={p.isTrialLesson} /></TableCell>
                    <TableCell><BoolMark value={p.showInApp} /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <PackageDialog pkg={p} groupOptions={groupOptions} onSaved={onSaved}>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" aria-label={t("Edit package")}>
                            <Pencil className="size-4" />
                          </Button>
                        </PackageDialog>
                        <DeletePackage name={p.name} onConfirm={() => onDelete(p.id)} />
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

function DeletePackage({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Delete package")}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Delete package?")}</AlertDialogTitle>
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
