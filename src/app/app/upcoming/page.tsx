import { getGymWaitlist } from "@/app/(app)/classes/calendar/actions";
import { getMySchedule } from "@/app/app/booking-actions";
import { MemberBookingList } from "@/components/mobile/my-schedule-list";
import { MobileTopTabs } from "@/components/mobile/mobile-top-tabs";
import { WaitlistTab } from "@/components/mobile/waitlist-tab";
import { getAppViewer } from "@/lib/app-viewer";
import { getT } from "@/lib/i18n/server";

/**
 * Upcoming. For members it's "My Schedule", split into Enrolled / Waiting List.
 * For staff/owners it's a single Waiting List where they approve or reject the
 * clients waiting for a spot.
 */
export default async function UpcomingPage() {
  const viewer = await getAppViewer();

  if (viewer.kind === "member") {
    const classes = await getMySchedule();
    const enrolled = classes.filter((c) => c.myStatus === "booked" || c.myStatus === "attended");
    const waitlisted = classes.filter((c) => c.myStatus === "waitlisted");
    return (
      <MobileTopTabs
        tabs={[
          { value: "enrolled", label: "Enrolled", content: <MemberBookingList classes={enrolled} /> },
          {
            value: "waitlist",
            label: "Waiting List",
            content: <MemberBookingList classes={waitlisted} emptyKey="You're not on any waiting lists." />,
          },
        ]}
      />
    );
  }

  // Staff/owner: a single Waiting List to approve or reject waitlisted clients.
  const t = await getT();
  const entries = await getGymWaitlist();
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
        <h1 className="font-heading text-lg font-semibold">{t("Waiting List")}</h1>
      </header>
      <WaitlistTab entries={entries} />
    </div>
  );
}
