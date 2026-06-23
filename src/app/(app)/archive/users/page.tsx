import type { Metadata } from "next";
import Link from "next/link";

import { ArchivedUsersTable } from "@/components/archive/archived-users-table";
import { getArchivedUsers } from "@/lib/archive/archived-users-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Archived Users" };

export default async function ArchivedUsersPage() {
  const users = await getArchivedUsers();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Archived Users")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Archived Users")}</h1>

      <ArchivedUsersTable users={users} />
    </div>
  );
}
