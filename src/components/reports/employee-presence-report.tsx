"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, SendHorizontal } from "lucide-react";

import { createStaffShift } from "@/app/(app)/reports/actions";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { type Column, ReportDataTable } from "@/components/reports/report-data-table";
import { StatusPill } from "@/components/reports/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { type IdName } from "@/lib/classes";
import { fmtDateTime, money } from "@/lib/reports/format";
import { type Shift } from "@/lib/reports/employee-presence";
import { useT } from "@/lib/i18n/provider";

const inRange = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};

export function EmployeePresenceReport({ shifts: all, employees }: { shifts: Shift[]; employees: IdName[] }) {
  const t = useT();
  const [employee, setEmployee] = React.useState("all");
  const [from, setFrom] = React.useState("2026-06-01");
  const [to, setTo] = React.useState("2026-06-30");
  const [activeOnly, setActiveOnly] = React.useState(false);

  const empOptions = React.useMemo(() => employees.map((e) => ({ value: e.id, label: e.name })), [employees]);

  const rows = React.useMemo(
    () =>
      all.filter(
        (s) =>
          (employee === "all" || s.employeeId === employee) &&
          inRange(s.start, from, to) &&
          (!activeOnly || s.status === "active")
      ),
    [all, employee, from, to, activeOnly]
  );

  const columns: Column<Shift>[] = [
    { key: "employeeName", header: "Employee Name", value: (s) => s.employeeName, cell: (s) => <span dir="auto" className="font-medium">{s.employeeName}</span> },
    { key: "start", header: "Start Time", value: (s) => s.start, cell: (s) => fmtDateTime(s.start) },
    { key: "end", header: "End Time", value: (s) => s.end, cell: (s) => fmtDateTime(s.end) },
    { key: "hourlyRate", header: "Hourly Rate", value: (s) => s.hourlyRate, cell: (s) => money(s.hourlyRate) },
    { key: "duration", header: "Duration", value: (s) => s.duration, cell: (s) => s.duration.toFixed(2) },
    { key: "total", header: "Total", value: (s) => s.total, cell: (s) => money(s.total) },
    { key: "status", header: "Status", value: (s) => s.status, cell: (s) => <StatusPill tone={s.status === "active" ? "blue" : "green"} label={s.status === "active" ? "Active" : "Completed"} /> },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterField label="From date" className="w-full sm:w-44"><Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-44"><Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
          <FilterSelect label="Employee" value={employee} onChange={setEmployee} options={empOptions} className="w-full sm:w-44" />
          <label className="flex items-center gap-2 text-sm">
            {t("Show the active shifts only")}
            <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
          </label>
          <AddShiftDialog employees={employees}>
            <Button className="ms-auto"><Plus className="size-4" /> {t("Add Shift")}</Button>
          </AddShiftDialog>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">{t("Details")}</h3>
          <ReportDataTable rows={rows} columns={columns} filename="employee-presence-report.csv" />
        </div>
      </CardContent>
    </Card>
  );
}

function AddShiftDialog({ employees, children }: { employees: IdName[]; children: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [employee, setEmployee] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const onSave = () => {
    if (!employee || !start || !end) { toast.error(t("Please fill all fields")); return; }
    startTransition(async () => {
      const res = await createStaffShift({ trainerId: employee, start, end });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("Shift added"));
      setOpen(false);
      setEmployee("");
      setStart("");
      setEnd("");
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4"><SheetTitle>{t("Add shift")}</SheetTitle></SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <Field label={t("Employee")}>
            <Select value={employee || undefined} onValueChange={setEmployee}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("Select employee")} /></SelectTrigger>
              <SelectContent>
                {employees.filter((e) => e.id !== "all").map((e) => (
                  <SelectItem key={e.id} value={e.id}><span dir="auto">{e.name}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("Start time")}><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label={t("End time")}><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
        </div>
        <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => setOpen(false)}>{t("Cancel")}</Button>
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <>{t("Save")} <SendHorizontal className="size-4" /></>}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-[#595959]">{label}</span>
      {children}
    </div>
  );
}
