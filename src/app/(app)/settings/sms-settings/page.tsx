import type { Metadata } from "next";
import Link from "next/link";

import { SmsSettingsForm } from "@/components/settings/sms-settings-form";
import { getSmsSettings } from "@/lib/settings/sms-settings-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "SMS Settings" };

export default async function SmsSettingsPage() {
  const settings = await getSmsSettings();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("SMS Settings")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("SMS Settings")}</h1>

      <SmsSettingsForm settings={settings} />
    </div>
  );
}
