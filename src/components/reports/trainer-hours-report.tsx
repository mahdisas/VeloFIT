"use client";

import * as React from "react";
import Link from "next/link";

import { FilterField, FilterSelect } from "@/components/reports/filter-select";
import { type Column, ReportDataTable } from "@/components/reports/report-data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type IdName } from "@/lib/classes";
import { fmtDate, money } from "@/lib/reports/format";
import { summarizeTrainerHours, type TrainerHourRow } from "@/lib/reports/trainer-hours";
import { useT } from "@/lib/i18n/provider";

const inRange = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};

export function TrainerHoursReport({ rows: all, trainers }: { rows: TrainerHourRow[]; trainers: IdName[] }) {
  const tr = useT();
  const [from, setFrom] = React.useState("2026-06-01");
  const [to, setTo] = React.useState("2026-06-30");
  const [trainer, setTrainer] = React.useState(trainers[0]?.id ?? "");
  const [showCanceled, setShowCanceled] = React.useState(false);

  const trainerOptions = React.useMemo(() => trainers.map((t) => ({ value: t.id, label: t.name })), [trainers]);

  const details = React.useMemo(
    () => all.filter((r) => inRange(r.date, from, to) && (showCanceled || !r.canceled)),
    [all, from, to, showCanceled]
  );
  const summary = React.useMemo(() => summarizeTrainerHours(details), [details]);
  const totals = summary.reduce(
    (t, s) => ({ classes: t.classes + s.totalClasses, hours: t.hours + s.totalHours, hourly: t.hourly + s.totalSumHourly, classRate: t.classRate + s.totalSumClass }),
    { classes: 0, hours: 0, hourly: 0, classRate: 0 }
  );

  const detailColumns: Column<TrainerHourRow>[] = [
    { key: "className", header: "Class", value: (r) => r.className, cell: (r) => <span dir="auto" className="font-medium text-primary">{r.className}</span> },
    { key: "date", header: "Date", value: (r) => r.date, cell: (r) => <span className="text-muted-foreground">{fmtDate(r.date)} - {r.weekday}</span> },
    { key: "fromHour", header: "From Hour", value: (r) => r.fromHour },
    { key: "toHour", header: "To Hour", value: (r) => r.toHour },
    { key: "enrollments", header: "Enrollments", value: (r) => r.enrollments },
    { key: "duration", header: "Duration", value: (r) => r.duration, cell: (r) => r.duration.toFixed(2) },
    { key: "classRate", header: "Class Rate", value: (r) => r.classRate },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <FilterField label="From date" className="w-full sm:w-52"><Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></FilterField>
          <FilterField label="To date" className="w-full sm:w-52"><Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></FilterField>
          <FilterSelect label="Trainer" value={trainer} onChange={setTrainer} options={trainerOptions} className="w-full sm:w-64" />
        </div>

        {/* Studio Summary */}
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">{tr("Studio Summary")}</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{tr("Class")}</TableHead>
                  <TableHead>{tr("Total Classes")}</TableHead>
                  <TableHead>{tr("Total Hours")}</TableHead>
                  <TableHead>{tr("Total Sum (Hourly Rate)")}</TableHead>
                  <TableHead>{tr("Total Sum (Class Rate)")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((s) => (
                  <TableRow key={s.className}>
                    <TableCell><span dir="auto" className="text-primary">{s.className}</span></TableCell>
                    <TableCell>{s.totalClasses}</TableCell>
                    <TableCell>{s.totalHours.toFixed(2)}</TableCell>
                    <TableCell>{money(s.totalSumHourly)}</TableCell>
                    <TableCell>{money(s.totalSumClass)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t bg-muted/30 font-semibold hover:bg-muted/30">
                  <TableCell>{tr("TOTAL")}:</TableCell>
                  <TableCell>{totals.classes}</TableCell>
                  <TableCell>{totals.hours.toFixed(2)}</TableCell>
                  <TableCell>{money(totals.hourly)}</TableCell>
                  <TableCell>{money(totals.classRate)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">{tr("Details")}</h3>
          <label className="flex w-fit items-center gap-2 text-sm">
            {tr("Show canceled classes")}
            <Switch checked={showCanceled} onCheckedChange={setShowCanceled} />
          </label>
          <ReportDataTable rows={details} columns={detailColumns} filename="trainer-hours-report.csv" totalColumnKey="duration" totalFormat={(n) => n.toFixed(2)} />
        </div>
      </CardContent>
    </Card>
  );
}
