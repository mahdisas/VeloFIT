"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

/** Graceful boundary for any failed profile data fetch. */
export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error("Client profile failed to load:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid size-12 place-content-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </div>
      <p className="text-lg font-medium">{t("Couldn't load this client")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{error.message}</p>
      <div className="mt-1 flex gap-2">
        <Button onClick={reset}>{t("Try again")}</Button>
        <Button variant="outline" asChild>
          <Link href="/clients">{t("Back to clients")}</Link>
        </Button>
      </div>
    </div>
  );
}
