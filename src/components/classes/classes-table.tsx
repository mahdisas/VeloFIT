"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";

import { ClassWizardDialog } from "@/components/classes/class-wizard-dialog";
import { deleteClass, restoreClass } from "@/app/(app)/classes/class-actions";
import { formatDate } from "@/lib/format";
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
import { type ClassItem, type IdName } from "@/lib/classes";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "name" | "hourlyRate" | "minParticipants" | "maxParticipants";


export function ClassesTable({
  classes: initial,
  trainers,
  classKinds,
  locations,
  groups,
}: {
  classes: ClassItem[];
  trainers: IdName[];
  classKinds: IdName[];
  locations: IdName[];
  groups: IdName[];
}) {
  const t = useT();
  const [classes, setClasses] = React.useState(initial);
  const [active, setActive] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const kindName = React.useMemo(() => new Map(classKinds.map((k) => [k.id, k.name])), [classKinds]);
  const trainerName = React.useMemo(() => new Map(trainers.map((t) => [t.id, t.name])), [trainers]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return classes.filter((c) => c.isActive === active && (!q || c.name.toLowerCase().includes(q)));
  }, [classes, active, query]);

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

  const onSaved = (cls: ClassItem) => {
    const exists = classes.some((c) => c.id === cls.id);
    setClasses((prev) =>
      prev.some((c) => c.id === cls.id) ? prev.map((c) => (c.id === cls.id ? cls : c)) : [cls, ...prev]
    );
    toast.success(exists ? t("Class updated") : t("Class added"));
  };

  const onDelete = (id: string) => {
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: false } : c)));
    void deleteClass(id);
    toast.success(t("Class moved to inactive"));
  };

  const onRestore = (id: string) => {
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: true } : c)));
    void restoreClass(id);
    toast.success(t("Class restored"));
  };

  const wizardProps = { trainers, classKinds, locations, groups, onSaved };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("Search in classes")} className="ps-9" />
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            <SegBtn active={active} onClick={() => { setActive(true); setPage(1); }}>{t("Active Classes")}</SegBtn>
            <SegBtn active={!active} onClick={() => { setActive(false); setPage(1); }}>{t("Inactive Classes")}</SegBtn>
          </div>
          <ClassWizardDialog {...wizardProps}>
            <Button><Plus className="size-4" /> {t("Add New Class")}</Button>
          </ClassWizardDialog>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortHead label={t("Name")} k="name" sort={sort} onClick={toggleSort} />
                <TableHead className="text-muted-foreground">{t("Class Kind")}</TableHead>
                <TableHead className="text-muted-foreground">{t("Trainer")}</TableHead>
                <SortHead label={t("Hourly Rate")} k="hourlyRate" sort={sort} onClick={toggleSort} />
                <SortHead label={t("Min Participants")} k="minParticipants" sort={sort} onClick={toggleSort} />
                <SortHead label={t("Max Participants")} k="maxParticipants" sort={sort} onClick={toggleSort} />
                <TableHead className="text-muted-foreground">{t("Expire Date")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    {t("No data available in the table")}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><span dir="auto" className="font-medium">{c.name}</span></TableCell>
                    <TableCell><span dir="auto">{kindName.get(c.classKindId ?? "") ?? "—"}</span></TableCell>
                    <TableCell><span dir="auto">{trainerName.get(c.trainerId ?? "") ?? "—"}</span></TableCell>
                    <TableCell>{c.hourlyRate}</TableCell>
                    <TableCell>{c.minParticipants}</TableCell>
                    <TableCell>{c.maxParticipants}</TableCell>
                    <TableCell>{formatDate(c.expireDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <ClassWizardDialog {...wizardProps} classItem={c}>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" aria-label={t("Edit class")}>
                            <Pencil className="size-4" />
                          </Button>
                        </ClassWizardDialog>
                        {active ? (
                          <DeleteClass name={c.name} onConfirm={() => onDelete(c.id)} />
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Undo class")} onClick={() => onRestore(c.id)}>
                                <RotateCcw className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("Undo class")}</TooltipContent>
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

function SortHead({
  label,
  k,
  sort,
  onClick,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onClick: (k: SortKey) => void;
}) {
  return (
    <TableHead>
      <button type="button" onClick={() => onClick(k)} className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground">
        {label}
        <ChevronsUpDown className={cn("size-3.5", sort.key === k ? "text-foreground" : "text-muted-foreground/50")} />
      </button>
    </TableHead>
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

function DeleteClass({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Delete class")}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Move class to inactive?")}</AlertDialogTitle>
          <AlertDialogDescription>
            <span dir="auto" className="font-medium text-foreground">{name}</span> {t("will be deactivated. You can restore it from the Inactive Classes tab.")}
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
