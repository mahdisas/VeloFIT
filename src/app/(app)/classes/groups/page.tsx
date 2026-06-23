import type { Metadata } from "next";
import Link from "next/link";

import { GroupsTable } from "@/components/classes/groups-table";
import { getGroupsPageData } from "@/lib/classes-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Groups Management" };

export default async function GroupsManagementPage() {
  const { groups, classOptions } = await getGroupsPageData();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Groups Management")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Groups Management")}</h1>

      <GroupsTable groups={groups} classOptions={classOptions} />
    </div>
  );
}
