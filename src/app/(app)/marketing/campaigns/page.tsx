import type { Metadata } from "next";
import Link from "next/link";

import { CampaignsTable } from "@/components/marketing/campaigns-table";
import { getCampaigns } from "@/lib/marketing/campaigns-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Campaigns")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Campaigns")}</h1>

      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
