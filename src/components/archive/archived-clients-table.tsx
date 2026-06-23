"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronsUpDown, RotateCcw, Search } from "lucide-react";

import { restoreClient } from "@/app/(app)/archive/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { ageFromBirthDate, initials, type ClientListRow } from "@/lib/clients";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "number" | "fullName" | "nationalId" | "age" | "phone" | "gender";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "fullName", label: "Full Name" },
  { key: "nationalId", label: "ID" },
  { key: "age", label: "Age" },
  { key: "phone", label: "Phone Number" },
  { key: "gender", label: "Gender" },
];

export function ArchivedClientsTable({ clients: initial }: { clients: ClientListRow[] }) {
  const t = useT();
  const [clients, setClients] = React.useState(initial);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "number", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter(
      (c) => !q || c.fullName.toLowerCase().includes(q) || c.nationalId.includes(q) || c.phone.includes(q) || String(c.number).includes(q)
    );
  }, [clients, query]);

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === "age") return ((ageFromBirthDate(a.birthDate) ?? 0) - (ageFromBirthDate(b.birthDate) ?? 0)) * factor;
      if (sort.key === "number") return (a.number - b.number) * factor;
      return String(a[sort.key]).localeCompare(String(b[sort.key])) * factor;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const onRestore = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    void restoreClient(id);
    toast.success(t("Client restored"));
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("Search Clients...")} className="ps-9" />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20">
                  <button type="button" onClick={() => toggleSort("number")} className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground">
                    # <ChevronsUpDown className={cn("size-3.5", sort.key === "number" ? "text-foreground" : "text-muted-foreground/50")} />
                  </button>
                </TableHead>
                <TableHead className="w-16 text-center font-medium text-muted-foreground">{t("Image")}</TableHead>
                {COLUMNS.map((col) => (
                  <TableHead key={col.key}>
                    <button type="button" onClick={() => toggleSort(col.key)} className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground">
                      {t(col.label)}
                      <ChevronsUpDown className={cn("size-3.5", sort.key === col.key ? "text-foreground" : "text-muted-foreground/50")} />
                    </button>
                  </TableHead>
                ))}
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 3} className="h-24 text-center text-muted-foreground">
                    {t("No data available in the table")}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((c) => {
                  const age = ageFromBirthDate(c.birthDate);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-primary">{c.number}</TableCell>
                      <TableCell>
                        <Avatar className="size-9">
                          <AvatarImage src={c.avatarUrl ?? undefined} alt={c.fullName} />
                          <AvatarFallback className="bg-accent text-xs font-medium text-primary">
                            <span dir="auto">{initials(c.fullName)}</span>
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell><span dir="auto" className="font-medium">{c.fullName}</span></TableCell>
                      <TableCell className="text-muted-foreground">{c.nationalId || ""}</TableCell>
                      <TableCell>{age ?? ""}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{t(c.gender)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Restore client")} onClick={() => onRestore(c.id)}>
                            <RotateCcw className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
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
