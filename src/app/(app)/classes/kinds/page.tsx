import type { Metadata } from "next";
import Link from "next/link";

import { ClassKindsTable } from "@/components/classes/class-kinds-table";
import { getClassKinds } from "@/lib/classes-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Classes Kinds" };

export default async function ClassesKindsPage() {
  const kinds = await getClassKinds();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Classes Kinds")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Classes Kinds")}</h1>

      <ClassKindsTable kinds={kinds} />
    </div>
  );
}
