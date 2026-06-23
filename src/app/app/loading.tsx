import { Loader2 } from "lucide-react";

/** Instant loading state shown inside the mobile shell while a tab's data loads. */
export default function MobileAppLoading() {
  return (
    <div className="flex h-full items-center justify-center py-24">
      <Loader2 className="size-7 animate-spin text-primary" />
    </div>
  );
}
