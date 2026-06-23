"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { ClassKindDialog } from "@/components/classes/class-kind-dialog";
import { deleteClassKind } from "@/app/(app)/classes/kinds/actions";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { type ClassKind } from "@/lib/class-kinds";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "name" | "description" | "minParticipants" | "maxParticipants";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "minParticipants", label: "Min Participants" },
  { key: "maxParticipants", label: "Max Participants" },
];

export function ClassKindsTable({ kinds: initial }: { kinds: ClassKind[] }) {
  const t = useT();
  const [kinds, setKinds] = React.useState(initial);
  const [active, setActive] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return kinds.filter((k) => k.isActive === active && (!q || k.name.toLowerCase().includes(q) || k.description.toLowerCase().includes(q)));
  }, [kinds, active, query]);

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

  const onSaved = (kind: ClassKind) => {
    const exists = kinds.some((k) => k.id === kind.id);
    setKinds((prev) =>
      prev.some((k) => k.id === kind.id)
        ? prev.map((k) => (k.id === kind.id ? kind : k))
        : [kind, ...prev]
    );
    toast.success(exists ? t("Class kind updated") : t("Class kind added"));
  };

  const onDelete = (id: string) => {
    setKinds((prev) => prev.filter((k) => k.id !== id));
    void deleteClassKind(id);
    toast.success(t("Class kind deleted"));
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("Search in classes")} className="ps-9" />
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            <SegBtn active={active} onClick={() => { setActive(true); setPage(1); }}>{t("Active Kinds")}</SegBtn>
            <SegBtn active={!active} onClick={() => { setActive(false); setPage(1); }}>{t("Inactive Kinds")}</SegBtn>
          </div>
          <ClassKindDialog onSaved={onSaved}>
            <Button><Plus className="size-4" /> {t("Add Class Kind")}</Button>
          </ClassKindDialog>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16" />
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
                paged.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <Avatar className="size-9 rounded-md">
                        <AvatarImage src={k.imageUrl ?? undefined} alt={k.name} />
                        <AvatarFallback className="rounded-md bg-accent text-sm font-medium text-accent-foreground">
                          <span dir="auto">{k.name.charAt(0)}</span>
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell><span dir="auto" className="font-medium">{k.name}</span></TableCell>
                    <TableCell className="text-muted-foreground"><span dir="auto">{k.description || "—"}</span></TableCell>
                    <TableCell>{k.minParticipants}</TableCell>
                    <TableCell>{k.maxParticipants}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <ClassKindDialog kind={k} onSaved={onSaved}>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" aria-label={t("Edit class kind")}>
                            <Pencil className="size-4" />
                          </Button>
                        </ClassKindDialog>
                        <DeleteKind name={k.name} onConfirm={() => onDelete(k.id)} />
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

function DeleteKind({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Delete class kind")}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Delete class kind?")}</AlertDialogTitle>
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
