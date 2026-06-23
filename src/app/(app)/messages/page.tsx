import type { Metadata } from "next";
import Link from "next/link";

import { MessageCenter } from "@/components/messages/message-center";
import { getGroups, getTemplates } from "@/lib/messages-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Messages Center" };

export default async function MessagesCenterPage() {
  const [groups, templates] = await Promise.all([getGroups(), getTemplates()]);
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Messages Center")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Messages Center")}</h1>

      <MessageCenter groups={groups} initialTemplates={templates} />
    </div>
  );
}
