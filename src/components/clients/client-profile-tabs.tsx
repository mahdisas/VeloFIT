"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  FileSpreadsheet,
  FileText,
  ListChecks,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  addMeasurement,
  createClientTask,
  deleteMeasurement,
  deleteSubscription,
  updateMeasurement,
} from "@/app/(app)/clients/client-actions";
import { DocumentDialog } from "@/components/clients/document-dialog";
import { FormDialog } from "@/components/clients/form-dialog";
import {
  type Column,
  ProfileTablePanel,
} from "@/components/clients/profile-table-panel";
import { SubscriptionDialog } from "@/components/clients/subscription-dialog";
import { SubscriptionHistoryDialog } from "@/components/clients/subscription-history-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs as TabsPrimitive } from "radix-ui";
import {
  type AccountingDocument,
  type AccountingInvoiceType,
  type ClassHistoryEntry,
  type ClientSubscription,
  type ClientTask,
  type Communication,
  INVOICE_TYPES,
  measurementColumnLabel,
  type MeasurementEntry,
  type MeasurementType,
  type SubscriptionPlanOption,
} from "@/lib/clients";
import { cn } from "@/lib/utils";
import { formatDate as fmtDate, formatDateTime as fmtDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { FormField, FormFieldValue } from "@/components/clients/form-dialog";

export type ProfileTabData = {
  subscriptions: ClientSubscription[];
  accounting: AccountingDocument[];
  measurements: MeasurementEntry[];
  measurementTypes: MeasurementType[];
  tasks: ClientTask[];
  communications: Communication[];
  classHistory: ClassHistoryEntry[];
};

const TABS = [
  { value: "subscriptions", label: "Subscriptions", Icon: CalendarClock },
  { value: "accounting", label: "Accounting", Icon: Banknote },
  { value: "fitness", label: "Fitness Progress", Icon: ListChecks },
  { value: "tasks", label: "Tasks", Icon: FileText },
  { value: "communication", label: "Communication", Icon: MessageSquare },
  { value: "classes", label: "Classes history", Icon: Clock3 },
] as const;

const money = (n: number) => `₪${n.toFixed(2)}`;

export function ClientProfileTabs({
  data,
  clientId,
  planOptions,
}: {
  data: ProfileTabData;
  clientId: string;
  planOptions: SubscriptionPlanOption[];
}) {
  const tr = useT();
  return (
    <TabsPrimitive.Root defaultValue="subscriptions" className="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
      {/* Single-line bar: scrolls horizontally on narrow screens (scrollbar hidden),
          never wraps, active tab = blue text + underline only (no box/ring). */}
      <TabsPrimitive.List className="scrollbar-hide flex w-full items-stretch gap-1 overflow-x-auto border-b">
        {TABS.map(({ value, label, Icon }) => (
          <TabsPrimitive.Trigger
            key={value}
            value={value}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            <Icon className="size-4" /> {tr(label)}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      <div className="pt-5">
        <TabsPrimitive.Content value="subscriptions" className="outline-none"><SubscriptionsTab rows={data.subscriptions} clientId={clientId} planOptions={planOptions} /></TabsPrimitive.Content>
        <TabsPrimitive.Content value="accounting" className="outline-none"><AccountingTab rows={data.accounting} clientId={clientId} /></TabsPrimitive.Content>
        <TabsPrimitive.Content value="fitness" className="outline-none"><FitnessTab rows={data.measurements} types={data.measurementTypes} clientId={clientId} /></TabsPrimitive.Content>
        <TabsPrimitive.Content value="tasks" className="outline-none"><TasksTab rows={data.tasks} clientId={clientId} /></TabsPrimitive.Content>
        <TabsPrimitive.Content value="communication" className="outline-none"><CommunicationTab rows={data.communications} /></TabsPrimitive.Content>
        <TabsPrimitive.Content value="classes" className="outline-none"><ClassesTab rows={data.classHistory} /></TabsPrimitive.Content>
      </div>
    </TabsPrimitive.Root>
  );
}

// --- Subscriptions ----------------------------------------------------------
function SubscriptionsTab({
  rows,
  clientId,
  planOptions,
}: {
  rows: ClientSubscription[];
  clientId: string;
  planOptions: SubscriptionPlanOption[];
}) {
  const tr = useT();
  const router = useRouter();
  const [active, setActive] = React.useState(true);
  const [pending, startTransition] = React.useTransition();
  const filtered = rows.filter((r) => (active ? r.status === "active" : r.status !== "active"));

  const remove = (id: string) =>
    startTransition(async () => {
      const res = await deleteSubscription(id, clientId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(tr("Subscription deleted"));
      router.refresh();
    });

  const columns: Column<ClientSubscription>[] = [
    { key: "status", header: tr("Status"), sortable: true, cell: (r) => <StatusBadge status={r.status} /> },
    { key: "group", header: tr("Group"), sortable: true, cell: (r) => <span dir="auto" className="inline-block max-w-40 truncate align-middle">{r.group}</span> },
    { key: "from", header: tr("From Date"), sortable: true, cell: (r) => fmtDate(r.fromDate) },
    { key: "to", header: tr("To Date"), sortable: true, cell: (r) => fmtDate(r.toDate) },
    { key: "balance", header: tr("Balance"), sortable: true, cell: (r) => (r.balance == null ? "—" : money(r.balance)) },
    {
      key: "actions",
      header: "",
      headClassName: "w-32",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <SubscriptionHistoryDialog subscription={r}>
            <IconBtn label={tr("History")}>
              <Clock3 className="size-4" />
            </IconBtn>
          </SubscriptionHistoryDialog>
          <SubscriptionDialog mode="edit" clientId={clientId} subscription={r} planOptions={planOptions} onSaved={() => router.refresh()}>
            <IconBtn label={tr("Edit")}><Pencil className="size-4" /></IconBtn>
          </SubscriptionDialog>
          <ConfirmDelete onConfirm={() => remove(r.id)} disabled={pending} label={tr("Delete subscription?")}>
            <IconBtn label={tr("Delete")} destructive><Trash2 className="size-4" /></IconBtn>
          </ConfirmDelete>
        </div>
      ),
    },
  ];

  return (
    <ProfileTablePanel
      rows={filtered}
      columns={columns}
      toolbar={
        <div className="flex flex-col gap-4">
          <SubscriptionDialog mode="new" clientId={clientId} planOptions={planOptions} onSaved={() => router.refresh()}>
            <Button className="w-fit"><Plus className="size-4" /> {tr("New Subscription")}</Button>
          </SubscriptionDialog>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input placeholder={tr("Search in subscriptions")} className="max-w-xs" />
            <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
              <SegBtn active={active} onClick={() => setActive(true)}>{tr("Active Subscriptions")}</SegBtn>
              <SegBtn active={!active} onClick={() => setActive(false)}>{tr("InActive Subscriptions")}</SegBtn>
            </div>
          </div>
        </div>
      }
    />
  );
}

// --- Accounting -------------------------------------------------------------
function AccountingTab({ rows: serverRows, clientId }: { rows: AccountingDocument[]; clientId: string }) {
  const tr = useT();
  const router = useRouter();
  const [docType, setDocType] = React.useState<AccountingInvoiceType | null>(null);
  // Local copy so a new document shows instantly; re-synced to the server list
  // once router.refresh() lands (the optimistic row is replaced by the real one).
  const [rows, setRows] = React.useState(serverRows);
  React.useEffect(() => setRows(serverRows), [serverRows]);

  const columns: Column<AccountingDocument>[] = [
    { key: "date", header: tr("Date"), sortable: true, cell: (r) => fmtDate(r.date) },
    { key: "no", header: tr("Invoice No."), sortable: true, cell: (r) => r.invoiceNo },
    { key: "type", header: tr("Invoice Type"), sortable: true, cell: (r) => <span className="text-amber-600">{tr(r.type)}</span> },
    { key: "vat", header: tr("VAT"), sortable: true, cell: (r) => money(r.vat) },
    { key: "amount", header: tr("Amount"), sortable: true, cell: (r) => money(r.amount) },
  ];

  const typeLabel = INVOICE_TYPES.find((t) => t.value === docType)?.label ?? "";

  return (
    <SubTabFrame label={tr("Accounting documents")} icon={<Banknote className="size-4" />}>
      <ProfileTablePanel
        rows={rows}
        columns={columns}
        toolbar={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="w-fit"><Plus className="size-4" /> {tr("New Document")} <ChevronDown className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {INVOICE_TYPES.map((t) => (
                <DropdownMenuItem key={t.value} onSelect={() => setDocType(t.value)}>{tr(t.label)}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <DocumentDialog
        type={docType}
        label={typeLabel}
        clientId={clientId}
        open={docType !== null}
        onOpenChange={(o) => !o && setDocType(null)}
        onCreated={(document) => {
          setRows((prev) => [document, ...prev]); // instant: show the new row
          setDocType(null);
          router.refresh(); // reconcile with server truth (no hard reload)
        }}
      />
    </SubTabFrame>
  );
}

// --- Fitness Progress -------------------------------------------------------
function FitnessTab({
  rows,
  types,
  clientId,
}: {
  rows: MeasurementEntry[];
  types: MeasurementType[];
  clientId: string;
}) {
  const tr = useT();
  const router = useRouter();

  const [editing, setEditing] = React.useState<MeasurementEntry | null>(null);

  const columns: Column<MeasurementEntry>[] = [
    { key: "date", header: tr("Date"), sortable: true, headClassName: "whitespace-nowrap", className: "whitespace-nowrap", cell: (r) => fmtDate(r.date) },
    ...types.map<Column<MeasurementEntry>>((t) => ({
      key: t.id,
      header: measurementColumnLabel(t),
      sortable: true,
      // Keep each column at its natural width so many measurement types make the
      // table scroll horizontally (within its card) instead of squashing.
      headClassName: "whitespace-nowrap",
      className: "whitespace-nowrap",
      cell: (r) => (r.values[t.id] ?? "—"),
    })),
    {
      key: "actions",
      header: "",
      headClassName: "w-20",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <IconBtn label={tr("Edit")} onClick={() => setEditing(r)}><Pencil className="size-4" /></IconBtn>
          <ConfirmDelete
            label={tr("Delete measurement?")}
            onConfirm={async () => {
              const res = await deleteMeasurement(r.id, clientId);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(tr("Measurement deleted"));
              router.refresh();
            }}
          >
            <IconBtn label={tr("Delete")} destructive><Trash2 className="size-4" /></IconBtn>
          </ConfirmDelete>
        </div>
      ),
    },
  ];

  /** Pull the {typeId,value} list out of a submitted form (skips blanks). */
  const collectValues = (v: Record<string, FormFieldValue>) =>
    types
      .filter((t) => String(v[`t_${t.id}`] ?? "").trim() !== "")
      .map((t) => ({ typeId: t.id, value: Number(v[`t_${t.id}`]) || 0 }));

  const editFields: FormField[] = editing
    ? [
        { name: "date", label: "Date", type: "date", defaultValue: editing.date, required: true },
        ...types.map<FormField>((t) => ({
          name: `t_${t.id}`,
          label: measurementColumnLabel(t),
          type: "number",
          defaultValue: editing.values[t.id] != null ? String(editing.values[t.id]) : "",
        })),
      ]
    : [];

  const exportCsv = () => {
    const header = ["Date", ...types.map(measurementColumnLabel)];
    const lines = rows.map((r) => [r.date, ...types.map((t) => r.values[t.id] ?? "")].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "measurements.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(tr("Exported measurements.csv"));
  };

  const addFields: FormField[] = [
    { name: "date", label: "Date", type: "date", defaultValue: new Date().toISOString().slice(0, 10), required: true },
    ...types.map<FormField>((t) => ({ name: `t_${t.id}`, label: measurementColumnLabel(t), type: "number" })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold">{tr("Measurements")}</h3>
      {types.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {tr("No measurement types configured. Add them in")}{" "}
          <span className="font-medium text-foreground">{tr("Settings · Measurement Types")}</span> {tr("to start tracking progress.")}
        </p>
      ) : (
        <>
          <ProfileTablePanel
            rows={rows}
            columns={columns}
            maxBodyHeight={500}
            toolbar={
              <div className="flex items-center justify-between">
                <FormDialog
                  title="Add Measurement"
                  columns={3}
                  fields={addFields}
                  submitLabel="Add Measurement"
                  onSubmit={(v) => {
                    void addMeasurement(clientId, { measuredOn: String(v.date), values: collectValues(v) }).then((res) => {
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success(tr("Measurement added"));
                      router.refresh();
                    });
                  }}
                >
                  <Button className="w-fit"><Plus className="size-4" /> {tr("Add Measurement")}</Button>
                </FormDialog>
                <IconBtn label={tr("Excel export")} onClick={exportCsv}><FileSpreadsheet className="size-4" /></IconBtn>
              </div>
            }
          />

          {/* Edit a specific measurement row (controlled — opened from the row's pencil). */}
          <FormDialog
            title="Edit Measurement"
            columns={3}
            open={editing !== null}
            onOpenChange={(o) => !o && setEditing(null)}
            fields={editFields}
            submitLabel="Update Measurement"
            onSubmit={(v) => {
              if (!editing) return;
              const id = editing.id;
              void updateMeasurement(id, clientId, { measuredOn: String(v.date), values: collectValues(v) }).then((res) => {
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success(tr("Measurement updated"));
                setEditing(null);
                router.refresh();
              });
            }}
          />
        </>
      )}
    </div>
  );
}

// --- Tasks ------------------------------------------------------------------
function TasksTab({ rows, clientId }: { rows: ClientTask[]; clientId: string }) {
  const tr = useT();
  const router = useRouter();
  const columns: Column<ClientTask>[] = [
    { key: "date", header: tr("Date"), sortable: true, cell: (r) => fmtDate(r.date) },
    { key: "title", header: tr("Title"), sortable: true, cell: (r) => <span dir="auto" className="inline-block align-middle">{r.title}</span> },
    { key: "status", header: tr("Status"), sortable: true, cell: (r) => tr(r.status) },
    { key: "blocking", header: tr("Blocking Entry"), cell: (r) => (r.blockingEntry ? tr("Yes") : tr("No")) },
    { key: "reminder", header: tr("Reminder Date"), sortable: true, cell: (r) => (r.reminderDate ? fmtDate(r.reminderDate) : "—") },
  ];
  return (
    <ProfileTablePanel
      rows={rows}
      columns={columns}
      toolbar={
        <FormDialog
          title="Add Task"
          fields={[
            { name: "title", label: "Title", type: "text", required: true },
            { name: "date", label: "Date", type: "date", defaultValue: new Date().toISOString().slice(0, 10), required: true },
            { name: "status", label: "Status", type: "select", defaultValue: "new", options: [
              { value: "new", label: "New" },
              { value: "in_progress", label: "In Progress" },
              { value: "canceled", label: "Canceled" },
              { value: "finished", label: "Finished" },
            ] },
            { name: "reminder", label: "Reminder Date", type: "date" },
            { name: "blocking", label: "Blocking Entry", type: "checkbox" },
          ]}
          submitLabel="Add Task"
          onSubmit={(v) => {
            void createClientTask(clientId, {
              title: String(v.title),
              taskDate: String(v.date),
              status: String(v.status) as NewTaskStatus,
              reminderDate: v.reminder ? String(v.reminder) : "",
              blockingEntry: Boolean(v.blocking),
            }).then((res) => {
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(tr("Task added"));
              router.refresh();
            });
          }}
        >
          <Button className="w-fit"><Plus className="size-4" /> {tr("Add Task")}</Button>
        </FormDialog>
      }
    />
  );
}
type NewTaskStatus = "new" | "in_progress" | "canceled" | "finished";

// --- Communication ----------------------------------------------------------
function CommunicationTab({ rows }: { rows: Communication[] }) {
  const tr = useT();
  const { from, setFrom, to, setTo, inRange } = useDateRange();
  const filtered = rows.filter((r) => inRange(r.date));
  const columns: Column<Communication>[] = [
    { key: "date", header: tr("Date"), sortable: true, cell: (r) => fmtDateTime(r.date) },
    { key: "type", header: tr("Type"), sortable: true, cell: (r) => tr(r.type) },
    { key: "content", header: tr("Content"), sortable: true, cell: (r) => <span dir="auto" className="inline-block max-w-md truncate align-middle">{r.content}</span> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold">{tr("Communication")}</h3>
      <div className="flex flex-wrap gap-4">
        <DateField label={tr("From date")} value={from} onChange={setFrom} />
        <DateField label={tr("To date")} value={to} onChange={setTo} />
      </div>
      <p className="text-center text-sm font-semibold">{tr("Total {n}", { n: filtered.length })}</p>
      <ProfileTablePanel rows={filtered} columns={columns} />
    </div>
  );
}

// --- Classes history --------------------------------------------------------
function weekday(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
}

function ClassesTab({ rows }: { rows: ClassHistoryEntry[] }) {
  const tr = useT();
  const { from, setFrom, to, setTo, inRange } = useDateRange();
  const filtered = rows.filter((r) => inRange(r.date));
  const columns: Column<ClassHistoryEntry>[] = [
    {
      key: "num",
      header: "#",
      headClassName: "w-12",
      cell: (r) => <span className="text-muted-foreground">{rows.indexOf(r) + 1}</span>,
    },
    {
      key: "checkIn",
      header: tr("Check In"),
      headClassName: "w-24",
      cell: (r) =>
        r.checkedIn ? (
          <Check className="size-4 text-emerald-600" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "date",
      header: tr("Date"),
      sortable: true,
      cell: (r) => (
        <span className="whitespace-nowrap">
          {fmtDate(r.date)} <span className="text-muted-foreground">- {tr(weekday(r.date))}</span>
        </span>
      ),
    },
    {
      key: "hours",
      header: tr("Hours"),
      sortable: true,
      cell: (r) => <span className="whitespace-nowrap" dir="ltr">{r.startTime} - {r.endTime}</span>,
    },
    { key: "class", header: tr("Class Name"), sortable: true, cell: (r) => <span dir="auto">{r.className}</span> },
    {
      key: "notes",
      header: tr("Notes"),
      headClassName: "w-20",
      cell: (r) =>
        r.hasNotes ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-primary hover:text-primary/80" aria-label={tr("View notes")}>
                  <FileText className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent dir="auto" className="max-w-xs whitespace-pre-wrap text-start">
                {r.notes}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold">{tr("Classes history")}</h3>
      <div className="flex flex-wrap gap-4">
        <DateField label={tr("From date")} value={from} onChange={setFrom} />
        <DateField label={tr("To date")} value={to} onChange={setTo} />
      </div>
      <p className="text-center text-sm font-semibold">{tr("Total Enrolls {n}", { n: filtered.length })}</p>
      <ProfileTablePanel rows={filtered} columns={columns} />
    </div>
  );
}

// --- Small shared bits ------------------------------------------------------
function StatusBadge({ status }: { status: ClientSubscription["status"] }) {
  const tr = useT();
  const styles: Record<ClientSubscription["status"], string> = {
    active: "bg-emerald-100 text-emerald-700",
    inactive: "bg-slate-100 text-slate-600",
    frozen: "bg-sky-100 text-sky-700",
    expired: "bg-rose-100 text-rose-700",
  };
  const labels: Record<ClientSubscription["status"], string> = {
    active: "Active",
    inactive: "Inactive",
    frozen: "Frozen",
    expired: "Expired",
  };
  return <Badge className={cn("capitalize", styles[status])}>{tr(labels[status])}</Badge>;
}

function ConfirmDelete({
  label,
  onConfirm,
  disabled,
  children,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const tr = useT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>{tr("This action cannot be undone.")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tr("Cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            className={cn(buttonVariants({ variant: "destructive" }))}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {tr("Delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SubTabFrame({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit items-center gap-1.5 border-b-2 border-primary pb-2 text-sm font-medium text-primary">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 transition-colors",
        active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

const IconBtn = React.forwardRef<
  HTMLButtonElement,
  {
    label: string;
    destructive?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
  } & React.ComponentProps<typeof Button>
>(function IconBtn({ label, destructive, onClick, children, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8", destructive ? "text-destructive hover:text-destructive" : "text-primary")}
      aria-label={label}
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  );
});

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-48" />
    </div>
  );
}

/** From/To date-range filter state. Empty bound = open-ended; "" / "" = show all. */
function useDateRange() {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const inRange = (iso: string) => {
    const d = iso.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };
  return { from, setFrom, to, setTo, inRange };
}
