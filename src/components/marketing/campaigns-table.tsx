"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { CampaignDialog } from "@/components/marketing/campaign-dialog";
import { deleteCampaign } from "@/app/(app)/marketing/campaigns/actions";
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
import { type Campaign } from "@/lib/marketing/campaigns";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "name" | "platformType" | "campaignType" | "url";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "platformType", label: "Platform Type Name" },
  { key: "campaignType", label: "Campaign Type Name" },
  { key: "url", label: "URL" },
];

export function CampaignsTable({ campaigns: initial }: { campaigns: Campaign[] }) {
  const t = useT();
  const [campaigns, setCampaigns] = React.useState(initial);
  const [active, setActive] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter(
      (c) =>
        c.isActive === active &&
        (!q || c.name.toLowerCase().includes(q) || c.platformType.toLowerCase().includes(q) || c.campaignType.toLowerCase().includes(q))
    );
  }, [campaigns, active, query]);

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => String(a[sort.key]).localeCompare(String(b[sort.key])) * factor);
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const onSaved = (campaign: Campaign) => {
    const exists = campaigns.some((c) => c.id === campaign.id);
    setCampaigns((prev) =>
      prev.some((c) => c.id === campaign.id) ? prev.map((c) => (c.id === campaign.id ? campaign : c)) : [campaign, ...prev]
    );
    toast.success(exists ? t("Campaign updated") : t("Campaign added"));
  };

  const onDelete = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    void deleteCampaign(id);
    toast.success(t("Campaign deleted"));
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("Search Campaign")} className="ps-9" />
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            <SegBtn active={active} onClick={() => { setActive(true); setPage(1); }}>{t("Active Campaigns")}</SegBtn>
            <SegBtn active={!active} onClick={() => { setActive(false); setPage(1); }}>{t("Inactive Campaigns")}</SegBtn>
          </div>
          <CampaignDialog onSaved={onSaved}>
            <Button><Plus className="size-4" /> {t("Add Campaign")}</Button>
          </CampaignDialog>
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
                paged.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><span dir="auto" className="font-medium">{c.name}</span></TableCell>
                    <TableCell>{c.platformType}</TableCell>
                    <TableCell>{c.campaignType}</TableCell>
                    <TableCell className="max-w-xs">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <span className="line-clamp-1 break-all">{c.url}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <CampaignDialog campaign={c} onSaved={onSaved}>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" aria-label={t("Edit campaign")}>
                            <Pencil className="size-4" />
                          </Button>
                        </CampaignDialog>
                        <DeleteCampaign name={c.name} onConfirm={() => onDelete(c.id)} />
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

function DeleteCampaign({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Delete campaign")}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Delete campaign?")}</AlertDialogTitle>
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
