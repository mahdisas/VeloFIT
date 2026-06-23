"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronsUpDown,
  FileSpreadsheet,
  FileText,
  Pencil,
  Printer,
  Search,
  Trash2,
} from "lucide-react";

import { deleteTask, updateTaskStatus } from "@/app/(app)/tasks/actions";
import { formatDate } from "@/lib/format";
import { TaskDialog } from "@/components/tasks/task-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  statusConfig,
  TASK_STATUSES,
  type TaskRow,
  type TaskStatus,
} from "@/lib/tasks";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type SortKey = "clientName" | "date" | "title" | "status" | "reminderDate";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "clientName", label: "Client Name" },
  { key: "date", label: "Date" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "reminderDate", label: "Reminder Date" },
];

const fmtDate = formatDate;

export function TasksTable({ tasks: initial }: { tasks: TaskRow[] }) {
  const tr = useT();
  const [tasks, setTasks] = React.useState(initial);
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | "all">("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (q && !t.clientName.toLowerCase().includes(q) && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, statusFilter, from, to, query]);

  const sorted = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? "")) * factor);
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const onStatusChange = (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    void updateTaskStatus(id, status);
  };

  const onSaved = (updated: TaskRow) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    toast.success(tr("Task updated"));
  };

  const onDelete = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    void deleteTask(id);
    toast.success(tr("Task deleted"));
  };

  const exportCsv = () => {
    const header = ["Client Name", "Date", "Title", "Status", "Reminder Date", "Blocking Entry"];
    const lines = sorted.map((t) =>
      [t.clientName, t.date, t.title, statusConfig(t.status).label, t.reminderDate ?? "", t.blockingEntry ? "Yes" : "No"]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );
    const url = URL.createObjectURL(new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(tr("Exported tasks.csv"));
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4">
          <Field label={tr("Status")}>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as TaskStatus | "all"); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("All")}</SelectItem>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{tr(s.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={tr("From date")}>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-44" />
          </Field>
          <Field label={tr("To date")}>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-44" />
          </Field>
        </div>

        {/* Search + exports */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={tr("Search in tasks")} className="pl-9" />
          </div>
          <div className="flex items-center gap-1">
            <ExportBtn label={tr("Excel export")} onClick={exportCsv}><FileSpreadsheet className="size-4" /></ExportBtn>
            <ExportBtn label={tr("CSV export")} onClick={exportCsv}><FileText className="size-4" /></ExportBtn>
            <ExportBtn label={tr("Print")} onClick={() => window.print()}><Printer className="size-4" /></ExportBtn>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((col) => (
                  <TableHead key={col.key}>
                    <button type="button" onClick={() => toggleSort(col.key)} className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground">
                      {tr(col.label)}
                      <ChevronsUpDown className={cn("size-3.5", sort.key === col.key ? "text-foreground" : "text-muted-foreground/50")} />
                    </button>
                  </TableHead>
                ))}
                <TableHead>{tr("Blocking Entry")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 2} className="h-24 text-center text-muted-foreground">
                    {tr("No tasks found.")}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/clients/${t.clientId}`} dir="auto" className="font-medium text-primary hover:underline">
                        {t.clientName}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(t.date)}</TableCell>
                    <TableCell><span dir="auto" className="inline-block max-w-60 truncate align-middle">{t.title}</span></TableCell>
                    <TableCell>
                      <StatusSelect status={t.status} onChange={(s) => onStatusChange(t.id, s)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(t.reminderDate)}</TableCell>
                    <TableCell>
                      {t.blockingEntry ? (
                        <Badge className="bg-rose-100 text-rose-700">{tr("Yes")}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <TaskDialog task={t} onSaved={onSaved}>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-primary" aria-label={tr("Edit task")}>
                            <Pencil className="size-4" />
                          </Button>
                        </TaskDialog>
                        <DeleteTask name={t.clientName} onConfirm={() => onDelete(t.id)} />
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

/** Inline status pill that doubles as an editable dropdown. */
function StatusSelect({ status, onChange }: { status: TaskStatus; onChange: (s: TaskStatus) => void }) {
  const t = useT();
  const cfg = statusConfig(status);
  return (
    <Select value={status} onValueChange={(v) => onChange(v as TaskStatus)}>
      <SelectTrigger className={cn("h-7 w-auto gap-1 rounded-full border-0 px-3 text-xs font-medium shadow-none focus-visible:ring-0", cfg.className)}>
        <SelectValue>{t(cfg.label)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>{t(s.label)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DeleteTask({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useT();
  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={t("Delete task")}>
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("Delete task")}</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Delete task?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("This will permanently remove the task for")}{" "}
            <span dir="auto" className="font-medium text-foreground">{name}</span>.
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

function ExportBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
