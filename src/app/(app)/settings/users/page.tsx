import type { Metadata } from "next";
import Link from "next/link";

import { UsersTable } from "@/components/settings/users-table";
import { getUsers } from "@/lib/settings/users-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const users = await getUsers();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Users")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Users")}</h1>

      <UsersTable users={users} />
    </div>
  );
}
