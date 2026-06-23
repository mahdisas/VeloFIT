"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronsUpDown, Search, Trash2, UserRoundCheck } from "lucide-react";

import { convertLead, deleteLead } from "@/app/(app)/leads/actions";
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
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/provider";
import { ageFromBirthDate, initials, type LeadListRow } from "@/lib/leads";
import { cn } from "@/lib/utils";

type SortKey = "fullName" | "nationalId" | "age" | "phone" | "gender";

const COLUMNS: { key: SortKey | "image"; label: string; sortable: boolean; className?: string }[] = [
  { key: "image", label: "Image", sortable: false, className: "w-24 text-center" },
  { key: "fullName", label: "Full Name", sortable: true },
  { key: "nationalId", label: "ID", sortable: true },
  { key: "age", label: "Age", sortable: true },
  { key: "phone", label: "Phone Number", sortable: true },
  { key: "gender", label: "Gender", sortable: true },
];

export function LeadsTable({ leads }: { leads: LeadListRow[] }) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "fullName",
    dir: "asc",
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.fullName.toLowerCase().includes(q) ||
        l.nationalId.includes(q) ||
        l.phone.includes(q)
    );
  }, [leads, query]);

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const get = (l: LeadListRow) =>
        sort.key === "age" ? ageFromBirthDate(l.birthDate) ?? -1 : l[sort.key];
      const av = get(a);
      const bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );

  const onConvert = (lead: LeadListRow) =>
    convertLead(lead.id).then(() => {
      toast.success(t("{name} converted to client", { name: lead.fullName }));
      router.refresh();
    });

  const onDelete = (lead: LeadListRow) =>
    deleteLead(lead.id).then(() => {
      toast.success(t("Lead deleted"));
      router.refresh();
    });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t("Search Clients...")}
            className="pl-9"
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    {col.sortable ? (
                      <SortButton
                        label={t(col.label)}
                        active={sort.key === col.key}
                        onClick={() => toggleSort(col.key as SortKey)}
                      />
                    ) : (
                      <span className="font-medium text-muted-foreground">{t(col.label)}</span>
                    )}
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
                paged.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Avatar className="mx-auto size-9">
                        <AvatarImage src={l.avatarUrl ?? undefined} alt={l.fullName} />
                        <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
                          <span dir="auto">{initials(l.fullName)}</span>
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <span dir="auto" className="flex items-center gap-2 font-medium">
                        {l.fullName}
                        {l.blocked && <Badge className="bg-rose-100 text-rose-700">{t("Blocked")}</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.nationalId}</TableCell>
                    <TableCell>{ageFromBirthDate(l.birthDate) ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">{l.phone}</TableCell>
                    <TableCell className="capitalize">{t(l.gender)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <RowAction label={t("Convert to client")} onClick={() => onConvert(l)}>
                          <UserRoundCheck className="size-4" />
                        </RowAction>
                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Delete lead")}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>{t("Delete lead")}</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("Delete lead?")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("This will permanently remove")}{" "}
                                <span dir="auto" className="font-medium text-foreground">{l.fullName}</span>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                className={cn(buttonVariants({ variant: "destructive" }))}
                                onClick={(e) => {
                                  e.preventDefault();
                                  onDelete(l);
                                }}
                              >
                                {t("Delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </CardContent>
    </Card>
  );
}

function SortButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      <ChevronsUpDown className={cn("size-3.5", active ? "text-foreground" : "text-muted-foreground/50")} />
    </button>
  );
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
