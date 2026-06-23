import { Construction } from "lucide-react";

import { getT } from "@/lib/i18n/server";

/** Temporary stand-in so every sidebar route resolves while modules are built out. */
export async function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const t = await getT();
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t(title)}</h1>
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Construction className="size-6" />
        </div>
        <p className="text-lg font-medium">{t("{title} is coming soon", { title: t(title) })}</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {description ?? t("This module is on the roadmap and will be built in an upcoming iteration.")}
        </p>
      </div>
    </div>
  );
}
