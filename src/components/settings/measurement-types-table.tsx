"use client";

import * as React from "react";
import { toast } from "sonner";
import { GripVertical, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";

import { MeasurementTypeDialog } from "@/components/settings/measurement-type-dialog";
import {
  deleteMeasurementType,
  restoreMeasurementType,
} from "@/app/(app)/settings/measurement-types/actions";
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
import { type MeasurementType } from "@/lib/settings/measurement-types";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function MeasurementTypesTable({ types: initial }: { types: MeasurementType[] }) {
  const tr = useT();
  const [types, setTypes] = React.useState(initial);
  const [active, setActive] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return types.filter((t) => t.isActive === active && (!q || t.name.toLowerCase().includes(q)));
  }, [types, active, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const onSaved = (type: MeasurementType) => {
    const exists = types.some((t) => t.id === type.id);
    setTypes((prev) =>
      prev.some((t) => t.id === type.id)
        ? prev.map((t) => (t.id === type.id ? type : t))
        : [...prev, { ...type, order: prev.filter((t) => t.isActive).length + 1 }]
    );
    toast.success(exists ? tr("Measurement type updated") : tr("Measurement type added"));
  };

  const onDelete = (id: string) => {
    setTypes((prev) => prev.filter((t) => t.id !== id));
    void deleteMeasurementType(id);
    toast.success(tr("Measurement type deleted"));
  };

  const onRestore = (id: string) => {
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, isActive: true } : t)));
    void restoreMeasurementType(id);
    toast.success(tr("Measurement type restored"));
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={tr("Search measurement by name")} className="pl-9" />
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            <SegBtn active={active} onClick={() => { setActive(true); setPage(1); }}>{tr("Active Types")}</SegBtn>
            <SegBtn active={!active} onClick={() => { setActive(false); setPage(1); }}>{tr("Inactive Types")}</SegBtn>
          </div>
          <MeasurementTypeDialog onSaved={onSaved}>
            <Button><Plus className="size-4" /> {tr("New Measurement Type")}</Button>
          </MeasurementTypeDialog>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10" />
                <TableHead className="w-16" />
                <TableHead className="text-xs tracking-wide text-muted-foreground uppercase">{tr("Name")}</TableHead>
                <TableHead className="text-xs tracking-wide text-muted-foreground uppercase">{tr("Type")}</TableHead>
                <TableHead className="text-xs tracking-wide text-muted-foreground uppercase">{tr("Notes")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {tr("No data available in the table")}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <GripVertical className="size-4 cursor-grab text-muted-foreground/50" aria-label={tr("Drag to reorder")} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{active ? t.order : 0}</TableCell>
                    <TableCell><span dir="auto" className="font-medium">{t.name}</span></TableCell>
                    <TableCell className="text-muted-foreground">{t.unit || "—"}</TableCell>
                    <TableCell className="text-muted-foreground"><span dir="auto">{t.notes || ""}</span></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <MeasurementTypeDialog type={t} onSaved={onSaved}>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" aria-label={tr("Edit measurement type")}>
                            <Pencil className="size-4" />
                          </Button>
                        </MeasurementTypeDialog>
                        {active ? (
                          <DeleteType name={t.name} onConfirm={() => onDelete(t.id)} />
                        ) : (
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={tr("Restore measurement type")} onClick={() => onRestore(t.id)}>
                            <RotateCcw className="size-4" />
                          </Button>
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
          totalRows={filtered.length}
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

function DeleteType({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Delete measurement type")}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Delete measurement type?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("This will deactivate")} <span dir="auto" className="font-medium text-foreground">{name}</span>. {t("You can restore it from the Inactive tab.")}
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
