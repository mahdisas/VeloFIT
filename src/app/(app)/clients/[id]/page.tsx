import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientProfileCard } from "@/components/clients/client-profile-card";
import {
  ClientProfileTabs,
  type ProfileTabData,
} from "@/components/clients/client-profile-tabs";
import { ProfileSpeedDial } from "@/components/clients/profile-speed-dial";
import {
  getClient,
  getClientAccounting,
  getClientClassHistory,
  getClientCommunications,
  getClientEditData,
  getClientMeasurements,
  getClientActivityLogs,
  getClientSubscriptions,
  getClientTasks,
  getFamilyMembers,
  getMeasurementTypes,
  getSubscriptionPlanOptions,
} from "@/lib/clients-server";
import { getAuthedProfile } from "@/lib/dal";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Client profile" };

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Auth gate + tenant. Redirects to /login if not signed in / not provisioned.
  const { supabase, profile } = await getAuthedProfile();

  // All gym-scoped profile data in ONE parallel round-trip group (RLS hides other
  // gyms' rows). A DB failure throws → caught by error.tsx; empty results are
  // normal empty states handled inside each tab. getClient/editData drive the 404.
  const [
    client,
    editData,
    subscriptions,
    accounting,
    measurements,
    measurementTypes,
    classHistory,
    communications,
    tasks,
    planOptions,
    activityLogs,
    familyMembers,
  ] = await Promise.all([
    getClient(id),
    getClientEditData(supabase, profile.gymId, id),
    getClientSubscriptions(supabase, profile.gymId, id),
    getClientAccounting(supabase, profile.gymId, id),
    getClientMeasurements(supabase, profile.gymId, id),
    getMeasurementTypes(supabase, profile.gymId),
    getClientClassHistory(supabase, profile.gymId, id),
    getClientCommunications(supabase, profile.gymId, id),
    getClientTasks(supabase, profile.gymId, id),
    getSubscriptionPlanOptions(supabase, profile.gymId),
    getClientActivityLogs(supabase, profile.gymId, id),
    getFamilyMembers(supabase, profile.gymId, id),
  ]);
  // RLS resolves an out-of-tenant / missing id to null → 404.
  if (!client || !editData) notFound();

  const tabData: ProfileTabData = {
    subscriptions,
    accounting,
    measurements,
    measurementTypes,
    tasks,
    communications,
    classHistory,
  };

  const t = await getT();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <Link href="/clients" className="hover:text-foreground">{t("Clients")}</Link>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{t("Client profile")}</h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_1fr]">
        <ClientProfileCard client={client} editData={editData} activityLogs={activityLogs} familyMembers={familyMembers} />
        <ClientProfileTabs data={tabData} clientId={id} planOptions={planOptions} />
      </div>

      <ProfileSpeedDial clientId={id} planOptions={planOptions} />
    </div>
  );
}
