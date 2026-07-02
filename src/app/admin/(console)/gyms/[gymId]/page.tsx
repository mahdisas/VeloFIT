import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getDocCounters, getGymDetail } from "@/app/admin/actions";
import { GymEditForm } from "@/components/admin/gym-edit-form";
import { GymNumberingCard } from "@/components/admin/gym-numbering-card";
import { GymUsersPanel } from "@/components/admin/gym-users-panel";
import { getT } from "@/lib/i18n/server";

/** Admin · one gym — editable details, invoice numbering, and user management. */
export default async function AdminGymDetailPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params;
  const t = await getT();
  const [data, counters] = await Promise.all([getGymDetail(gymId), getDocCounters(gymId)]);
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" /> {t("Gyms")}
        </Link>
        <h1 className="mt-2 font-heading text-xl font-bold" dir="auto">{data.gym.name}</h1>
        <p className="text-sm text-muted-foreground" dir="ltr">{data.gym.code}</p>
      </div>

      <GymEditForm gym={data.gym} />
      <GymNumberingCard gymId={data.gym.id} counters={counters} />
      <GymUsersPanel gymId={data.gym.id} users={data.users} />
    </div>
  );
}
