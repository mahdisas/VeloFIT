import type { Metadata } from "next";
import Link from "next/link";

import { BusinessDetailsForm } from "@/components/business/business-details-form";
import { getBusinessDetails } from "@/lib/business-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Business details" };

export default async function BusinessDetailsPage() {
  const details = await getBusinessDetails();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Business details")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Business details")}</h1>

      <BusinessDetailsForm details={details} />
    </div>
  );
}
