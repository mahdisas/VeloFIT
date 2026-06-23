"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";

import { GroupDialog } from "@/components/classes/group-dialog";
import { deleteGroup, restoreGroup } from "@/app/(app)/classes/groups/actions";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type Group, type GroupClassOption } from "@/lib/groups";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "name" | "price1m" | "price2m" | "price3m" | "price4m" | "price6m" | "priceYearly";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "price1m", label: "1 Month Price" },
  { key: "price2m", label: "2 Months Price" },
  { key: "price3m", label: "3 Months Price" },
  { key: "price4m", label: "4 Months Price" },
  { key: "price6m", label: "6 Months Price" },
  { key: "priceYearly", label: "Yearly Price" },
];

const price = (n: number) => (n > 0 ? `${n}₪` : "");

export function GroupsTable({
  groups: initial,
  classOptions,
}: {
  groups: Group[];
  classOptions: GroupClassOption[];
}) {
  const t = useT();
  const [groups, setGroups] = React.useState(initial);
  const [active, setActive] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => g.isActive === active && (!q || g.name.toLowerCase().includes(q)));
  }, [groups, active, query]);

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

  const onSaved = (group: Group) => {
    const exists = groups.some((g) => g.id === group.id);
    setGroups((prev) =>
      prev.some((g) => g.id === group.id)
        ? prev.map((g) => (g.id === group.id ? group : g))
        : [group, ...prev]
    );
    toast.success(exists ? t("Group updated") : t("Group added"));
  };

  const onDelete = (id: string) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, isActive: false } : g)));
    void deleteGroup(id);
    toast.success(t("Group moved to inactive"));
  };

  const onRestore = (id: string) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, isActive: true } : g)));
    void restoreGroup(id);
    toast.success(t("Group restored"));
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("Search in groups")} className="ps-9" />
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            <SegBtn active={active} onClick={() => { setActive(true); setPage(1); }}>{t("Active Groups")}</SegBtn>
            <SegBtn active={!active} onClick={() => { setActive(false); setPage(1); }}>{t("Inactive Groups")}</SegBtn>
          </div>
          <GroupDialog classOptions={classOptions} onSaved={onSaved}>
            <Button><Plus className="size-4" /> {t("New Group")}</Button>
          </GroupDialog>
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
                paged.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell><span dir="auto" className="font-medium">{g.name}</span></TableCell>
                    <TableCell>{price(g.price1m)}</TableCell>
                    <TableCell>{price(g.price2m)}</TableCell>
                    <TableCell>{price(g.price3m)}</TableCell>
                    <TableCell>{price(g.price4m)}</TableCell>
                    <TableCell>{price(g.price6m)}</TableCell>
                    <TableCell>{price(g.priceYearly)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <GroupDialog group={g} classOptions={classOptions} onSaved={onSaved}>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" aria-label={t("Edit group")}>
                            <Pencil className="size-4" />
                          </Button>
                        </GroupDialog>
                        {active ? (
                          <DeleteGroup name={g.name} onConfirm={() => onDelete(g.id)} />
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Undo group")} onClick={() => onRestore(g.id)}>
                                <RotateCcw className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("Undo group")}</TooltipContent>
                          </Tooltip>
                        )}
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

function DeleteGroup({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Delete group")}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Move group to inactive?")}</AlertDialogTitle>
          <AlertDialogDescription>
            <span dir="auto" className="font-medium text-foreground">{name}</span> {t("will be deactivated. You can restore it from the Inactive Groups tab.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction className={cn(buttonVariants({ variant: "destructive" }))} onClick={(e) => { e.preventDefault(); onConfirm(); }}>
            {t("Deactivate")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
