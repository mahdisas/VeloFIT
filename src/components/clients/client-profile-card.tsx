"use client";

import * as React from "react";
import { History, Phone, Pencil, UserRoundPlus } from "lucide-react";

import { ActivityLogsDialog } from "@/components/clients/activity-logs-dialog";
import { EditClientDialog } from "@/components/clients/edit-client-dialog";
import { FamilyMembersDialog } from "@/components/clients/family-members-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type ActivityLog, type ClientEditData, type ClientProfile, type FamilyMember, initials } from "@/lib/clients";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Left-hand summary card on the client profile. */
export function ClientProfileCard({
  client,
  editData,
  activityLogs,
  familyMembers,
}: {
  client: ClientProfile;
  editData: ClientEditData;
  activityLogs: ActivityLog[];
  familyMembers: FamilyMember[];
}) {
  const t = useT();
  return (
    <Card className="h-fit p-6">
      <div className="flex items-center justify-between">
        <ActivityLogsDialog logs={activityLogs}>
          <CardIcon label={t("Activity Logs")}>
            <History className="size-5" />
          </CardIcon>
        </ActivityLogsDialog>
        <FamilyMembersDialog clientId={client.id} members={familyMembers}>
          <CardIcon label={t("Family members")}>
            <UserRoundPlus className="size-5" />
          </CardIcon>
        </FamilyMembersDialog>
      </div>

      <div className="flex flex-col items-center gap-3 pt-2">
        <Avatar className="size-32">
          <AvatarImage src={client.avatarUrl ?? undefined} alt={client.fullName} />
          <AvatarFallback className="bg-accent text-2xl font-medium text-accent-foreground">
            <span dir="auto">{initials(client.fullName)}</span>
          </AvatarFallback>
        </Avatar>

        <div className="flex items-center gap-1.5">
          <h2 dir="auto" className="text-lg font-semibold">{client.fullName}</h2>
          <EditClientDialog clientId={client.id} initial={editData}>
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("Edit client")}>
              <Pencil className="size-4" />
            </button>
          </EditClientDialog>
        </div>

        <dl className="flex flex-col items-center gap-1.5 text-sm">
          <Row label={t("Age")} value={client.age ?? "—"} />
          <a
            href={`tel:${client.phone}`}
            dir="ltr"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Phone className="size-3.5" />
            </span>
            {client.phone}
          </a>
          <Row
            label={t("Balance")}
            value={
              <span className={cn("font-medium", client.balance === 0 ? "text-emerald-600" : "text-destructive")}>
                {client.balance}
              </span>
            }
          />
          <Row label={t("Last Entrance")} value={<span className="text-muted-foreground">{formatDateTime(client.lastEntrance)}</span>} />
        </dl>

        {/* SMS / messaging is postponed to Phase 2 — disabled until a provider
            (Twilio/etc.) is wired. Kept visible per product requirement. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="mt-2 inline-block w-full">
              <Button className="w-full" disabled>{t("Send Message")}</Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("Coming soon")}</TooltipContent>
        </Tooltip>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="font-semibold">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

// forwardRef so it can be the asChild target of a Dialog trigger. Uses a native
// title tooltip (a Radix Tooltip can't compose with the Dialog trigger here).
const CardIcon = React.forwardRef<
  HTMLButtonElement,
  { label: string; children: React.ReactNode } & React.ComponentProps<"button">
>(function CardIcon({ label, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      className="text-muted-foreground transition-colors hover:text-foreground"
      {...props}
    >
      {children}
    </button>
  );
});
