"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronsUpDown, RotateCcw, Search } from "lucide-react";

import { restoreUser } from "@/app/(app)/archive/actions";
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
import { type ArchivedUser } from "@/lib/archive/archived-users";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "fullName" | "phone";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "fullName", label: "Name" },
  { key: "phone", label: "Phone Number" },
];

export function ArchivedUsersTable({ users: initial }: { users: ArchivedUser[] }) {
  const t = useT();
  const [users, setUsers] = React.useState(initial);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "fullName", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.phone.includes(q));
  }, [users, query]);

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => String(a[sort.key]).localeCompare(String(b[sort.key])) * factor);
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const onRestore = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    void restoreUser(id);
    toast.success(t("User restored"));
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("Search users")} className="ps-9" />
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
                <TableHead className="w-16" />
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
                paged.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell><span dir="auto" className="font-medium">{u.fullName}</span></TableCell>
                    <TableCell className="text-muted-foreground">{u.phone}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Restore user")} onClick={() => onRestore(u.id)}>
                          <RotateCcw className="size-4" />
                        </Button>
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
