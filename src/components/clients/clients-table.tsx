"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronsUpDown,
  ExternalLink,
  LogIn,
  Search,
  Trash2,
} from "lucide-react";

import { registerEntrance } from "@/app/(app)/clients/client-actions";
import { DeleteClientDialog } from "@/components/clients/delete-client-dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ageFromBirthDate,
  type ClientListRow,
  initials,
} from "@/lib/clients";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "number" | "fullName" | "nationalId" | "age" | "phone" | "gender";

const COLUMNS: { key: SortKey | "image"; label: string; sortable: boolean; className?: string }[] = [
  { key: "image", label: "Image", sortable: false, className: "w-24 text-center" },
  { key: "fullName", label: "Full Name", sortable: true },
  { key: "nationalId", label: "ID", sortable: true },
  { key: "age", label: "Age", sortable: true },
  { key: "phone", label: "Phone Number", sortable: true },
  { key: "gender", label: "Gender", sortable: true },
];

export function ClientsTable({ clients }: { clients: ClientListRow[] }) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "number",
    dir: "asc",
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.nationalId.includes(q) ||
        c.phone.includes(q)
    );
  }, [clients, query]);

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const get = (c: ClientListRow) =>
        sort.key === "age" ? ageFromBirthDate(c.birthDate) ?? -1 : c[sort.key];
      const av = get(a);
      const bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [filtered, sort]);

  // Keep the current page valid as filters change.
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );

  const openProfile = (id: string) => router.push(`/clients/${id}`);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {/* Search */}
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
                <TableHead className="w-16">
                  <SortButton label="#" active={sort.key === "number"} onClick={() => toggleSort("number")} />
                </TableHead>
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
                <TableHead className="w-32 text-right">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 2} className="h-24 text-center text-muted-foreground">
                    {t("No clients found.")}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => openProfile(c.id)}
                  >
                    <TableCell className="text-muted-foreground">{c.number}</TableCell>
                    <TableCell>
                      <Avatar className="mx-auto size-9">
                        <AvatarImage src={c.avatarUrl ?? undefined} alt={c.fullName} />
                        <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
                          <span dir="auto">{initials(c.fullName)}</span>
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <span dir="auto" className="font-medium">{c.fullName}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.nationalId}</TableCell>
                    <TableCell>{ageFromBirthDate(c.birthDate) ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground"><span dir="ltr">{c.phone}</span></TableCell>
                    <TableCell className="capitalize">{t(c.gender)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <RowAction
                          label={t("Add entry")}
                          onClick={async () => {
                            const res = await registerEntrance(c.id);
                            if (!res.ok) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success(t("Entrance registered for {name}", { name: c.fullName }));
                            router.refresh();
                          }}
                        >
                          <LogIn className="size-4" />
                        </RowAction>
                        <RowAction label={t("Open in a new window")} onClick={() => window.open(`/clients/${c.id}`, "_blank")}>
                          <ExternalLink className="size-4" />
                        </RowAction>
                        <DeleteClientDialog clientId={c.id} clientName={c.fullName}>
                          <RowAction label={t("Delete client")} destructive>
                            <Trash2 className="size-4" />
                          </RowAction>
                        </DeleteClientDialog>
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
  destructive,
  onClick,
  children,
}: {
  label: string;
  destructive?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", destructive ? "text-destructive hover:text-destructive" : "text-primary")}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
