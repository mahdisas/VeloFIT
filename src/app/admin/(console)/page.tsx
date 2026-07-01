import { listGyms } from "@/app/admin/actions";
import { GymsTable } from "@/components/admin/gyms-table";
import { NewGymDialog } from "@/components/admin/new-gym-dialog";
import { getT } from "@/lib/i18n/server";

/** Admin console home — every gym on the platform, plus a New Gym button. */
export default async function AdminGymsPage() {
  const t = await getT();
  const gyms = await listGyms();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold">{t("Gyms")}</h1>
          <p className="text-sm text-muted-foreground">{t("Manage every gym on the platform.")}</p>
        </div>
        <NewGymDialog />
      </div>
      <GymsTable gyms={gyms} />
    </div>
  );
}
