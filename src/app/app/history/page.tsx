import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getRecentAttendance } from "@/app/(app)/classes/calendar/actions";
import { getMyHistory } from "@/app/app/booking-actions";
import { MemberBookingList } from "@/components/mobile/my-schedule-list";
import { MobileAttendanceFeed } from "@/components/mobile/mobile-attendance-feed";
import { getAppViewer } from "@/lib/app-viewer";
import { getT } from "@/lib/i18n/server";

/**
 * Drawer screen. Members see their own attended classes ("History"); staff/owners
 * see a live "Activity" feed of the gym's most recent check-ins.
 */
export default async function HistoryPage() {
  const t = await getT();
  const viewer = await getAppViewer();
  const isMember = viewer.kind === "member";

  const [myHistory, activity] = await Promise.all([
    isMember ? getMyHistory() : Promise.resolve([]),
    isMember ? Promise.resolve([]) : getRecentAttendance(),
  ]);

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-3 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
        <Link
          href="/app/home"
          aria-label={t("Back")}
          className="grid size-9 shrink-0 place-content-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-5 rtl:rotate-180" />
        </Link>
        <h1 className="font-heading text-lg font-semibold">{isMember ? t("History") : t("Activity")}</h1>
      </header>
      {isMember ? (
        <MemberBookingList classes={myHistory} emptyKey="You haven't attended any classes yet." />
      ) : (
        <MobileAttendanceFeed entries={activity} />
      )}
    </div>
  );
}
