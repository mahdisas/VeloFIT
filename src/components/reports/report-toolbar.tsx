"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Printer, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/provider";

export type ExportData = {
  filename: string;
  header: string[];
  rows: (string | number)[][];
};

/**
 * Shared report toolbar: a "Search in report data" box plus Excel / CSV / Print
 * actions. `getExportData` is called lazily so exports always reflect the
 * current filtered + sorted rows.
 */
export function ReportToolbar({
  query,
  onQueryChange,
  getExportData,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  getExportData: () => ExportData;
}) {
  const t = useT();
  const downloadCsv = () => {
    const { filename, header, rows } = getExportData();
    const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
    const csv = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
    // Prepend a BOM so Excel reads the Hebrew (UTF-8) correctly.
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("Exported {filename}", { filename }));
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("Search in report data")}
          className="ps-9"
        />
      </div>
      <div className="flex items-center gap-1">
        <IconBtn label={t("Export to Excel")} onClick={downloadCsv}><FileSpreadsheet className="size-4" /></IconBtn>
        <IconBtn label={t("Export to CSV")} onClick={downloadCsv}><FileText className="size-4" /></IconBtn>
        <IconBtn label={t("Print")} onClick={() => window.print()}><Printer className="size-4" /></IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} className="text-muted-foreground hover:text-foreground" onClick={onClick}>
      {children}
    </Button>
  );
}
