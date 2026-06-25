"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { UserDialog } from "@/components/settings/user-dialog";
import { deleteUser } from "@/app/(app)/settings/users/actions";
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
import { type StaffUser } from "@/lib/settings/users";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "fullName" | "phone" | "hourlyRate";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "fullName", label: "Name" },
  { key: "phone", label: "Phone Number" },
  { key: "hourlyRate", label: "Hourly Rate" },
];

export function UsersTable({ users: initial }: { users: StaffUser[] }) {
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

  const onSaved = (user: StaffUser) => {
    const exists = users.some((u) => u.id === user.id);
    setUsers((prev) =>
      prev.some((u) => u.id === user.id) ? prev.map((u) => (u.id === user.id ? user : u)) : [user, ...prev]
    );
    toast.success(exists ? t("User updated") : t("User added"));
  };

  const onDelete = async (id: string) => {
    const snapshot = users; // to restore if the archive doesn't actually persist
    setUsers((prev) => prev.filter((u) => u.id !== id)); // optimistic
    const result = await deleteUser(id);
    if (!result.ok) {
      setUsers(snapshot); // server refused (e.g. your own account) — put the row back
      toast.error(result.error);
      return;
    }
    toast.success(t("User archived"));
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("Search users")} className="ps-9" />
          </div>
          <UserDialog onSaved={onSaved}>
            <Button><Plus className="size-4" /> {t("New User")}</Button>
          </UserDialog>
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
                paged.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell><span dir="auto" className="font-medium">{u.fullName}</span></TableCell>
                    <TableCell className="text-muted-foreground">{u.phone}</TableCell>
                    <TableCell>{u.hourlyRate}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <UserDialog user={u} onSaved={onSaved}>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" aria-label={t("Edit user")}>
                            <Pencil className="size-4" />
                          </Button>
                        </UserDialog>
                        <DeleteUser name={u.fullName} onConfirm={() => onDelete(u.id)} />
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

function DeleteUser({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Archive user")}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Archive user?")}</AlertDialogTitle>
          <AlertDialogDescription>
            <span dir="auto" className="font-medium text-foreground">{name}</span> {t("will be moved to Archive · Users. You can restore them later.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction className={cn(buttonVariants({ variant: "destructive" }))} onClick={(e) => { e.preventDefault(); onConfirm(); }}>
            {t("Archive")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
