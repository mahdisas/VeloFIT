import { AppShell } from "@/components/layout/app-shell";
import { ChatFab } from "@/components/chat-fab";
import { Toaster } from "@/components/ui/sonner";
import { getGymIdentity } from "@/lib/business-server";

/** Every authenticated page lives in this route group and shares the shell. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const gym = await getGymIdentity();
  return (
    <AppShell gym={gym}>
      {children}
      <ChatFab />
      <Toaster richColors position="top-center" />
    </AppShell>
  );
}
