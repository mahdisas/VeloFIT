import type { Metadata } from "next";
import Link from "next/link";

import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { LeadsTable } from "@/components/leads/leads-table";
import { getLeads } from "@/lib/leads-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage() {
  const leads = await getLeads();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Leads")}</span>
      </nav>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("Leads")}</h1>
        <AddLeadDialog />
      </div>

      <LeadsTable leads={leads} />
    </div>
  );
}
