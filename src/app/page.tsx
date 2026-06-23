import { redirect } from "next/navigation";

/** The app has no public landing page yet — land on the dashboard. */
export default function RootPage() {
  redirect("/dashboard");
}
