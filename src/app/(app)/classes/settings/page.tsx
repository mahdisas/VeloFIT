import type { Metadata } from "next";
import Link from "next/link";

import { ClassSettingsForm } from "@/components/classes/class-settings-form";
import { getClassSettings } from "@/lib/classes-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Classes Settings" };

export default async function ClassesSettingsPage() {
  const settings = await getClassSettings();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Classes Settings")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Classes Settings")}</h1>

      <ClassSettingsForm initial={settings} />
    </div>
  );
}
