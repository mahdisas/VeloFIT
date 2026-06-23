import type { Metadata } from "next";
import Link from "next/link";

import { CalendarView } from "@/components/classes/calendar/calendar-view";
import { toISO, visibleRange } from "@/lib/calendar";
import { getCalendarPageData } from "@/lib/classes-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const today = new Date();
  const initialDate = toISO(today);
  // The grid defaults to Month view → prefetch exactly that window.
  const initialRange = visibleRange("month", today);

  // One auth gate, then real (RLS-scoped) sessions + the control-bar/wizard options.
  const { initialSessions, trainers, classKinds, locations, groups, classPickerOptions } =
    await getCalendarPageData(initialRange.start, initialRange.end);
  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Calendar")}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Calendar")}</h1>

      <CalendarView
        initialDate={initialDate}
        initialSessions={initialSessions}
        initialRange={initialRange}
        kinds={classKinds}
        trainers={trainers}
        classKinds={classKinds}
        locations={locations}
        groups={groups}
        classPickerOptions={classPickerOptions}
      />
    </div>
  );
}
