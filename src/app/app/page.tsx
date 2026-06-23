import { redirect } from "next/navigation";

/** The mobile app opens on the Home (calendar) tab. */
export default function MobileAppIndex() {
  redirect("/app/home");
}
