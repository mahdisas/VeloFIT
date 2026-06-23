import type { Metadata } from "next";
import Link from "next/link";

import { TasksTable } from "@/components/tasks/tasks-table";
import { getTasks } from "@/lib/tasks-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const tasks = await getTasks();
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Tasks")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Tasks")}</h1>

      <TasksTable tasks={tasks} />
    </div>
  );
}
