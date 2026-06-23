import type { Metadata } from "next";
import Link from "next/link";

import { ArchivedClientsTable } from "@/components/archive/archived-clients-table";
import { getArchivedClients } from "@/lib/clients-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Archived Clients" };

export default async function ArchivedClientsPage() {
  const clients = await getArchivedClients();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Archived Clients")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Archived Clients")}</h1>

      <ArchivedClientsTable clients={clients} />
    </div>
  );
}
