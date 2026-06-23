import type { Metadata } from "next";
import Link from "next/link";

import { ClassesTable } from "@/components/classes/classes-table";
import { getClassesTableData } from "@/lib/classes-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Classes Table" };

export default async function ClassesTablePage() {
  // One auth gate, then real (RLS-scoped) classes + the wizard's relation options.
  const { classes, trainers, classKinds, locations, groups } = await getClassesTableData();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Classes Table")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Classes Table")}</h1>

      <ClassesTable
        classes={classes}
        trainers={trainers}
        classKinds={classKinds}
        locations={locations}
        groups={groups}
      />
    </div>
  );
}
