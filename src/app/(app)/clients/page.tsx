import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert, Users } from "lucide-react";

import { AddClientDialog } from "@/components/clients/add-client-dialog";
import { ClientsTable } from "@/components/clients/clients-table";
import { Card, CardContent } from "@/components/ui/card";
import { mapClientRow, type ClientListRow } from "@/lib/clients";
import { getAuthedProfile } from "@/lib/dal";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  // Auth gate + tenant. Redirects to /login if not signed in / not provisioned.
  const { supabase, profile } = await getAuthedProfile();
  const t = await getT();

  // Real, gym-scoped query. RLS already restricts rows to this gym; the explicit
  // gym_id filter makes the intent clear and is defense-in-depth.
  const { data, error } = await supabase
    .from("clients")
    .select("id, client_number, full_name, national_id, birth_date, phone, gender, avatar_url")
    .eq("gym_id", profile.gymId)
    .neq("status", "archived")
    .order("client_number", { ascending: true });

  const clients: ClientListRow[] = (data ?? []).map(mapClientRow);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">{t("Home")}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("Clients")}</span>
      </nav>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("Clients")}</h1>
        <AddClientDialog />
      </div>

      {error ? (
        <ErrorState message={error.message} t={t} />
      ) : clients.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <ClientsTable clients={clients} />
      )}
    </div>
  );
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function EmptyState({ t }: { t: Translate }) {
  return (
    <Card>
      <CardContent className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <div className="grid size-12 place-content-center rounded-full bg-accent text-accent-foreground">
          <Users className="size-6" />
        </div>
        <div>
          <p className="text-lg font-medium">{t("No clients yet")}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t("Add your first client to start managing subscriptions, classes and payments.")}
          </p>
        </div>
        <AddClientDialog />
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, t }: { message: string; t: Translate }) {
  return (
    <Card>
      <CardContent className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-center">
        <div className="grid size-12 place-content-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-6" />
        </div>
        <p className="text-lg font-medium">{t("Couldn't load clients")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
