import { MobileHome } from "@/components/mobile/mobile-home";
import { getCalendarSessions } from "@/lib/classes-server";
import { addDays, toISO } from "@/lib/calendar";

/**
 * Mobile Home tab — a horizontal date scroller over the gym's scheduled classes.
 * We pre-fetch a small window around "today" (server clock) so the first paint
 * already shows classes; the client picks its own local "today" and fetches any
 * other day on demand via the loadCalendarSessions server action.
 */
export default async function MobileHomePage() {
  const now = new Date();
  const start = toISO(addDays(now, -2));
  const end = toISO(addDays(now, 2));
  const initialSessions = await getCalendarSessions(start, end);

  return <MobileHome initialSessions={initialSessions} />;
}
