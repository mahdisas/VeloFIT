import { redirect } from "next/navigation";

/** No public landing page — land on the post-login gateway, which lets the
 *  user choose the desktop Control Panel or the mobile veloFIT App. */
export default function RootPage() {
  redirect("/portal");
}
