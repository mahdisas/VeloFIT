import type { Metadata } from "next";
import Link from "next/link";

import { MeasurementTypesTable } from "@/components/settings/measurement-types-table";
import { getMeasurementTypes } from "@/lib/settings/measurement-types-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Measurement Types" };

export default async function MeasurementTypesPage() {
  const types = await getMeasurementTypes();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Measurement Types")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Measurement Types")}</h1>

      <MeasurementTypesTable types={types} />
    </div>
  );
}
