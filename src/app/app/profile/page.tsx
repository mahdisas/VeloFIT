import { MobileProfile } from "@/components/mobile/mobile-profile";
import { getAppViewer } from "@/lib/app-viewer";
import { getGymInfo, getViewerProfile, getViewerSubscriptions } from "@/lib/mobile-server";

/**
 * Profile — the viewer's identity + language. Members also see their active
 * memberships; staff/owners see the gym's details instead.
 */
export default async function ProfilePage() {
  const viewer = await getAppViewer();
  const isMember = viewer.kind === "member";

  const [profile, subs, gym] = await Promise.all([
    getViewerProfile(viewer),
    isMember ? getViewerSubscriptions(viewer) : Promise.resolve({ count: 0, items: [] }),
    isMember ? Promise.resolve(null) : getGymInfo(viewer),
  ]);

  return <MobileProfile profile={profile} isMember={isMember} subscriptions={subs.items} gym={gym} />;
}
