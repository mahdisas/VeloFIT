import type { Metadata } from "next";
import Link from "next/link";

import { PackagesTable } from "@/components/finance/packages-table";
import { getGroupOptions, getPackages } from "@/lib/finance/packages-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Subscription Packages" };

export default async function SubscriptionPackagesPage() {
  const [packages, groupOptions] = await Promise.all([getPackages(), getGroupOptions()]);
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Subscription Packages")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Subscription Packages")}</h1>

      <PackagesTable packages={packages} groupOptions={groupOptions} />
    </div>
  );
}
