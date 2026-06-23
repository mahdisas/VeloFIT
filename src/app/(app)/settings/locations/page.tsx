import type { Metadata } from "next";
import Link from "next/link";

import { LocationsTable } from "@/components/settings/locations-table";
import { getLocations } from "@/lib/settings/locations-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  const locations = await getLocations();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Locations")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Locations")}</h1>

      <LocationsTable locations={locations} />
    </div>
  );
}
