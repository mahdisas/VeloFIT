import { getMemberSessions, getMySchedule } from "@/app/app/booking-actions";
import { MemberSchedule } from "@/components/mobile/member-schedule";
import { MobileDashboard } from "@/components/mobile/mobile-dashboard";
import { MobileHome } from "@/components/mobile/mobile-home";
import { MobileTopTabs } from "@/components/mobile/mobile-top-tabs";
import { getAppViewer } from "@/lib/app-viewer";
import { addDays, toISO } from "@/lib/calendar";
import { getCalendarSessionsFor } from "@/lib/classes-server";
import { flattenSessions } from "@/lib/mobile";
import { getViewerSubscriptions } from "@/lib/mobile-server";

/**
 * Mobile Home — Dashboard (greeting, next class, subscriptions) + Schedules.
 * Members get their own subscription cards + a group-filtered, bookable schedule;
 * staff get the gym-wide count + the owner calendar.
 */
export default async function MobileHomePage() {
  const viewer = await getAppViewer();
  const isMember = viewer.kind === "member";
  const now = new Date();
  const start = toISO(addDays(now, -2));
  const end = toISO(addDays(now, 7));

  const [sessions, subs, mySchedule] = await Promise.all([
    isMember ? getMemberSessions(start, end) : getCalendarSessionsFor(viewer.supabase, viewer.gymId, start, end),
    getViewerSubscriptions(viewer),
    isMember ? getMySchedule() : Promise.resolve([]),
  ]);
  const flat = flattenSessions(sessions);
  // The dashboard's "next class" tile uses the member's enrolled classes only.
  const enrolledClasses = mySchedule.filter((c) => c.myStatus === "booked" || c.myStatus === "attended");

  return (
    <MobileTopTabs
      tabs={[
        {
          value: "dashboard",
          label: "Dashboard",
          content: (
            <MobileDashboard
              name={viewer.name}
              sessions={flat}
              activeSubscriptions={subs.count}
              subscriptions={subs.items}
              isMember={isMember}
              enrolledClasses={enrolledClasses}
            />
          ),
        },
        {
          value: "schedules",
          label: "Schedules",
          content: isMember ? <MemberSchedule initialSessions={sessions} /> : <MobileHome initialSessions={sessions} />,
        },
      ]}
    />
  );
}
